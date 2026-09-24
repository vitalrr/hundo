import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { request } from '../services/api';
import { useMobileWallet } from '../utils/useMobileWallet';

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GameStage } from './GameStage';
import { WinnerResult } from './WinnerResult';
import { CrowdRecap } from './CrowdRecap';
import { personalCrowdResult, type CrowdQuestion } from '../game/crowd';
import { SystemChrome } from './SystemChrome';
import { resultOutcome, shouldTakeOver } from '../game/presentation';
import { ANSWER_MS, QUESTION_MS } from '../game/rules';

type Snapshot = {
 roundId:string;serverTime:string;startsAt:string;phase:'lobby'|'question'|'result'|'final';index:number;
 potWallet:string;potLamports:string;network:'devnet';survivorCap:number|null;playerCount:number;survivorCount:number;
 joined:boolean;eliminatedAt:number|null;myChoice:number|null;isRehearsal:boolean;
 question?:{text:string;options:string[]};counts?:number[];leaders?:number[];
 recap?:CrowdQuestion[];
 payouts?:{wallet:string;lamports:string;signature:string|null;status:string}[];
};
const connection = new Connection('https://api.devnet.solana.com','confirmed');
const explorer = (kind:string,id:string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
const sol = (value:string|number) => (Number(value)/1e9).toLocaleString('en-US',{maximumFractionDigits:9});
export function formatRoomCountdown(seconds: number): string {
 const safe = Math.max(0, Math.ceil(seconds));
 const hours = Math.floor(safe / 3600);
 const minutes = Math.floor(safe % 3600 / 60);
 const remainder = safe % 60;
 return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`;
}
export function LiveRound({address,open,onClose,onTakeOver,onVisibilityChange}:{address:string;open:boolean;onClose:()=>void;onTakeOver:()=>void;onVisibilityChange:(visible:boolean)=>void}) {
 const [dismissed,setDismissed]=useState<string|null>(null);
 const [foreground,setForeground]=useState(AppState.currentState!=='background');
 const [resumeCount,setResumeCount]=useState(0);
 useEffect(()=>{const listener=AppState.addEventListener('change',value=>{setForeground(value==='active');if(value==='active')setResumeCount(count=>count+1);});return()=>listener.remove();},[]);
 const wallet=useMobileWallet();const [roundId,setRoundId]=useState<string|null>(null);const [state,setState]=useState<Snapshot|null>(null);
 const snapshotRef=useRef(state);snapshotRef.current=state;
 const [localAnswer,setLocalAnswer]=useState<{round:string;index:number;choice:number}|null>(null);
 const submitting=useRef(false);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [balance,setBalance]=useState<number|null>(null);
 const [,setTick]=useState(0);const synced=useRef({offset:0,ready:false,at:0});const pendingEntry=useRef<{round:string;signature:string}|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setTick(n=>n+1),200);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  let stopped=false;let timer:ReturnType<typeof setTimeout>;
  async function poll(){
   let nextDelay=1000;
   try{
    let id=roundId;
    if(!id||snapshotRef.current?.phase==='final'){
     const latest=await request<{roundId:string|null}>('latest');
     if(latest.roundId&&latest.roundId!==id){id=latest.roundId;if(!stopped){setRoundId(id);setDismissed(null);}}
    }
    if(id){const sent=Date.now();const next=await request<Snapshot>('snapshot',{roundId:id});if(!stopped){
     const received=Date.now();
     const offset=Date.parse(next.serverTime)-(sent+received)/2;
     if(!synced.current.ready||Math.abs(offset-synced.current.offset)>250) synced.current.offset=offset;
     synced.current.ready=true;synced.current.at=received;
     setState(next);
     if(next.phase==='question'||next.phase==='result'){
      const boundary=Date.parse(next.startsAt)+next.index*QUESTION_MS+(next.phase==='question'?ANSWER_MS:QUESTION_MS);
      const untilBoundary=boundary-(received+synced.current.offset);
      nextDelay=untilBoundary<=350?200:Math.min(1000,Math.max(200,untilBoundary+80));
     }
    }}
    if(!stopped)setError('');
   }catch(e){if(!stopped)setError(e instanceof Error?e.message:'Connection unavailable');}
   finally{if(!stopped)timer=setTimeout(poll,nextDelay);}
  }
  void poll();return()=>{stopped=true;clearTimeout(timer);};
 },[roundId,address,resumeCount]);
 useEffect(()=>{
  if(!state?.potWallet||state.isRehearsal)return;let stopped=false;
  async function load(){try{const value=await connection.getBalance(new PublicKey(state!.potWallet));if(!stopped)setBalance(value);}catch{if(!stopped)setBalance(null);}}
  void load();const timer=setInterval(load,15000);return()=>{stopped=true;clearInterval(timer);};
 },[state?.potWallet,state?.isRehearsal]);
 async function join(){
  if(!state)return;setBusy(true);
  try{
   if(state.isRehearsal){await request('join-rehearsal',{roundId:state.roundId});setError('');return;}
   let signature=pendingEntry.current?.round===state.roundId?pendingEntry.current.signature:null;
   if(!signature){
    const latest=await connection.getLatestBlockhashAndContext('confirmed');
    const tx=new Transaction({feePayer:new PublicKey(address),...latest.value}).add(new TransactionInstruction({programId:new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),keys:[{pubkey:new PublicKey(address),isSigner:true,isWritable:false}],data:Buffer.from(`hundo:v1:join:${state.roundId}`)}));
    signature=await wallet.signAndSendTransaction(tx,latest.context.slot);
    pendingEntry.current={round:state.roundId,signature};
    const confirmed=await connection.confirmTransaction({...latest.value,signature},'finalized');
    if(confirmed.value.err)throw new Error('The transaction failed');
   }
   await request('join',{roundId:state.roundId,signature});setError('');
  }catch(e){Alert.alert('Join the game',e instanceof Error?e.message:'Could not join the game');}
  finally{setBusy(false);}
 }
 async function answer(choice:number){
  if(!state||submitting.current||state.phase!=='question'||state.myChoice!==null||!state.joined||state.eliminatedAt!==null)return;
  const selected={round:state.roundId,index:state.index,choice};
  submitting.current=true;setLocalAnswer(selected);setBusy(true);setError('');
  try{await request('answer',{roundId:selected.round,index:selected.index,choice});}
  catch(e){setLocalAnswer(current=>current===selected?null:current);setError(e instanceof Error?e.message:'Answer not accepted');}
  finally{submitting.current=false;setBusy(false);}
 }
 const displayedChoice=state?.myChoice??(state&&state.phase==='question'&&localAnswer?.round===state.roundId&&localAnswer.index===state.index?localAnswer.choice:null);
 const stale=!synced.current.ready||Date.now()-synced.current.at>3000;
 const serverNow=Date.now()+synced.current.offset;
 const deadline=state?Date.parse(state.startsAt)+(state.phase==='lobby'?0:state.index*QUESTION_MS+(state.phase==='question'?ANSWER_MS:QUESTION_MS)):0;
 const remainingMs=Math.max(0,deadline-serverNow);
 const remaining=Math.ceil(remainingMs/1000);
 const visible=open||!!(state&&dismissed!==state.roundId&&shouldTakeOver(state.phase,remaining));
 useEffect(()=>{onVisibilityChange(visible);return()=>onVisibilityChange(false);},[visible,onVisibilityChange]);
 useEffect(()=>{if(visible)onTakeOver();},[visible]);
 useEffect(()=>{if(!visible)return;const listener=BackHandler.addEventListener('hardwareBackPress',()=>{close();return true;});return()=>listener.remove();},[visible,state,dismissed]);
 function close(){
  if(state&&state.phase!=='final'&&shouldTakeOver(state.phase,remaining)){
   if(Platform.OS==='web'){if(window.confirm('Leave the live game? Missing an answer means elimination.')){setDismissed(state.roundId);onClose();}return;}
   Alert.alert('Leave the live game?','The game keeps going. Missing an answer means elimination.',[{text:'Stay',style:'cancel'},{text:'Leave',onPress:()=>{setDismissed(state.roundId);onClose();}}]);
  }else{if(state?.phase==='final')setDismissed(state.roundId);onClose();}
 }
 const stage=state&&(state.phase==='question'||state.phase==='result'||state.phase==='lobby'&&remaining<=15);
 const watching=state&&(!state.joined||state.eliminatedAt!==null)&&!(state.phase==='result'&&state.eliminatedAt===state.index);
 const background=watching?'#E7E7EF':'#EFE7FF';

 if(!visible)return null;
 return <View style={[StyleSheet.absoluteFillObject,{backgroundColor:background,zIndex:100,elevation:20}]}>
  <SafeAreaView style={{flex:1,backgroundColor:background}}><SystemChrome active={visible} color={background}/><StatusBar style="dark"/>
  {visible&&foreground&&stage&&state ? <GameStage phase={state.phase} index={state.index} seconds={remaining} remainingMs={remainingMs}
   question={state.question} choice={displayedChoice} counts={state.counts} leaders={state.leaders}
   alive={state.eliminatedAt===null} joined={state.joined} outcome={resultOutcome(state.joined,state.eliminatedAt,state.index)}
   disabled={busy||stale||remaining===0||state.phase!=='question'||!state.joined||state.eliminatedAt!==null||displayedChoice!==null}
   pending={busy} error={error} stale={stale} playerCount={state.playerCount} survivorCount={state.survivorCount} onAnswer={choice=>void answer(choice)} onExit={close}
  /> : visible&&state?.phase==='final'&&state.joined&&state.eliminatedAt===null ? <ScrollView contentContainerStyle={s.page}><Text style={s.wordmark}>hundo<Text style={{color:'#7047EB'}}>.</Text></Text><WinnerResult rehearsal={state.isRehearsal} finalists={state.survivorCount} players={state.playerCount} payout={state.payouts?.find(p=>p.wallet===address)} onHome={close}/>{state.recap?<CrowdRecap questions={state.recap}/>:null}</ScrollView> : <ScrollView contentContainerStyle={s.page}>
   <Text style={s.wordmark}>hundo<Text style={{color:'#7047EB'}}>.</Text></Text>
   <Text style={s.tag}>{state?.isRehearsal?'LIVE REHEARSAL':'LIVE GAME · DEVNET'}</Text>
   {error?<Text style={s.error}>{error}</Text>:null}
   {!state?<><Text style={s.title}>No game scheduled yet</Text><Text style={s.body}>The next game will appear here.</Text></>:<>
    <Text style={s.body}>{state.playerCount} joined · {state.survivorCount} still playing</Text>
    {state.phase==='lobby'&&<>
     <Text style={s.clock}>{formatRoomCountdown(remaining)}</Text>
     <Text style={s.title}>{state.joined?'You’re in!':'Ready to play?'}</Text>
     <Text style={s.body}>{state.joined?'Keep hundo open. The full-screen countdown starts 15 seconds before the game.':state.isRehearsal?'Join with your connected wallet. No transaction or network fee.':'Sign to record your entry on-chain. Your wallet pays a small network fee in test SOL.'}</Text>
     {!state.joined&&<Pressable accessibilityRole="button" style={s.button} disabled={busy||stale||remaining===0} onPress={()=>void join()}><Text style={s.buttonText}>{busy?'Confirming…':state.isRehearsal?'Join rehearsal':pendingEntry.current?'Check transaction again':'Sign to join'}</Text></Pressable>}
    </>}
    {state.survivorCap!==null&&<Text style={s.body}>Player cap: {state.survivorCap}. Ties at the speed cutoff all advance.</Text>}
    {!state.isRehearsal&&<><Text style={s.title}>{sol(state.potLamports)} SOL</Text><Text style={s.body}>Prize pool · Wallet balance: {balance===null?'unavailable':sol(balance)+' SOL'}</Text><Pressable onPress={()=>void Linking.openURL(explorer('address',state.potWallet))}><Text style={s.link}>View public wallet ↗</Text></Pressable></>}
    {state.phase==='final'&&<>
     <Text style={s.clock}>FINISH</Text>
     <Text style={s.title}>{state.joined&&state.eliminatedAt===null?'You made it!':state.joined?'The crowd surprised you.':'The room has spoken.'}</Text>
     <Text style={s.body}>{state.survivorCount} finalists out of {state.playerCount} people in the room.</Text>
     {state.eliminatedAt!==null&&state.recap?.find(q=>q.number===state.eliminatedAt)?<Text style={s.body}>{personalCrowdResult(state.recap.find(q=>q.number===state.eliminatedAt)!)}</Text>:null}
     {state.isRehearsal?<Text style={s.body}>Rehearsal complete — no payouts are sent.</Text>:state.payouts?.map(p=><View key={p.wallet} style={s.card}><Text style={s.body}>{p.wallet===address?'You':p.wallet.slice(0,4)+'…'+p.wallet.slice(-4)} · {sol(p.lamports)} SOL</Text>{p.status==='confirmed'&&p.signature?<Pressable onPress={()=>void Linking.openURL(explorer('tx',p.signature!))}><Text style={s.link}>View payout ↗</Text></Pressable>:<Text style={s.body}>Payout pending</Text>}</View>)}
    </>}
   </>}
   {state?.phase==='final'&&state.recap?<CrowdRecap questions={state.recap}/>:null}
   <Pressable accessibilityRole="button" style={s.back} onPress={close}><Text style={s.link}>Back to home</Text></Pressable>
  </ScrollView>}
  </SafeAreaView>
 </View>;
}
const s=StyleSheet.create({
 page:{padding:24,gap:20,flexGrow:1,maxWidth:600,width:'100%',alignSelf:'center'},wordmark:{fontSize:38,fontWeight:'900',letterSpacing:-2,color:'#202020'},
 tag:{color:'#7047EB',fontSize:11,fontWeight:'800',letterSpacing:1},title:{color:'#202020',fontSize:30,fontWeight:'800'},clock:{color:'#7047EB',fontSize:42,fontWeight:'900',fontVariant:['tabular-nums']},
 body:{color:'#5B5270',fontSize:15,lineHeight:23},error:{color:'#D72C42',fontSize:14},link:{color:'#7047EB',fontSize:15,fontWeight:'700'},button:{backgroundColor:'#7047EB',padding:20,borderRadius:16},buttonText:{fontWeight:'800',color:'#FFFFFF',textAlign:'center',fontSize:16},card:{backgroundColor:'#FFFFFF88',padding:20,borderRadius:16,gap:8},back:{marginTop:'auto',padding:20,alignItems:'center'},
});
