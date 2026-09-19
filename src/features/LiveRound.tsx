import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { request } from '../services/api';
import { useMobileWallet } from '../utils/useMobileWallet';

type Snapshot = {
 roundId:string;serverTime:string;startsAt:string;phase:'lobby'|'question'|'result'|'final';index:number;
 potWallet:string;potLamports:string;network:'devnet';survivorCap:number|null;playerCount:number;survivorCount:number;
 joined:boolean;eliminatedAt:number|null;myChoice:number|null;
 question?:{text:string;options:string[]};counts?:number[];leaders?:number[];
 payouts?:{wallet:string;lamports:string;signature:string|null;status:string}[];
};
const connection = new Connection('https://api.devnet.solana.com','confirmed');
const explorer = (kind:string,id:string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
const sol = (value:string|number) => (Number(value)/1e9).toLocaleString('en-US',{maximumFractionDigits:9});
export function LiveRound({address}:{address:string}) {
 const wallet=useMobileWallet();const [roundId,setRoundId]=useState<string|null>(null);const [state,setState]=useState<Snapshot|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [balance,setBalance]=useState<number|null>(null);
 const [tick,setTick]=useState(0);const synced=useRef({at:0,time:0});const pendingEntry=useRef<{round:string;signature:string}|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setTick(n=>n+1),200);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  let stopped=false;let timer:ReturnType<typeof setTimeout>;
  async function poll(){
   try{
    let id=roundId;
    if(!id){const latest=await request<{roundId:string|null}>('latest');id=latest.roundId;if(!stopped)setRoundId(id);}
    if(id){const next=await request<Snapshot>('snapshot',{roundId:id});if(!stopped){synced.current={at:performance.now(),time:Date.parse(next.serverTime)};setState(next);}}
    if(!stopped)setError('');
   }catch(e){if(!stopped)setError(e instanceof Error?e.message:'Connection unavailable');}
   finally{if(!stopped)timer=setTimeout(poll,1000);}
  }
  void poll();return()=>{stopped=true;clearTimeout(timer);};
 },[roundId,address]);
 useEffect(()=>{
  if(!state?.potWallet)return;let stopped=false;
  async function load(){try{const value=await connection.getBalance(new PublicKey(state!.potWallet));if(!stopped)setBalance(value);}catch{if(!stopped)setBalance(null);}}
  void load();const timer=setInterval(load,15000);return()=>{stopped=true;clearInterval(timer);};
 },[state?.potWallet]);
 async function join(){
  if(!state)return;setBusy(true);
  try{
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
 async function answer(choice:number){if(!state)return;setBusy(true);try{await request('answer',{roundId:state.roundId,index:state.index,choice});setState(current=>current?.index===state.index?{...current,myChoice:choice}:current);setError('');}catch(e){setError(e instanceof Error?e.message:'Answer not accepted');}finally{setBusy(false);}}
 const stale=performance.now()-synced.current.at>3000;
 const serverNow=synced.current.time+performance.now()-synced.current.at;
 const deadline=state?Date.parse(state.startsAt)+(state.phase==='lobby'?0:state.index*15000+(state.phase==='question'?10000:15000)):0;
 const remaining=Math.max(0,Math.ceil((deadline-serverNow)/1000));
 return <View style={s.panel}>
  <Text style={s.tag}>LIVE · DEVNET · TEST SOL</Text>
  {error?<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>:null}
  {!state?<><Text style={s.title}>No game scheduled yet</Text><Text style={s.body}>The next game will appear here.</Text></>:<>
   <Text style={s.body}>{state.playerCount} players · {state.survivorCount} still playing</Text>
   <Text style={s.title}>{sol(state.potLamports)} SOL</Text><Text style={s.body}>Prize pool · Wallet balance: {balance===null?'unavailable':`${sol(balance)} SOL`}</Text>
   <Pressable onPress={()=>void Linking.openURL(explorer('address',state.potWallet))}><Text style={s.link}>View public wallet ↗</Text></Pressable>
   {state.survivorCap!==null&&<Text style={s.body}>Player cap after each question: {state.survivorCap}. Players tied at the cutoff all advance.</Text>}
   {state.phase==='lobby'&&<>
    <Text style={s.title}>{Math.floor(remaining/60)}:{(remaining%60).toString().padStart(2,'0')}</Text>
    <Text style={s.body}>{state.joined?'Entry confirmed on-chain. Waiting for the game.':'Sign to record your entry on-chain. Entry is free; a small network fee is paid in test SOL.'}</Text>
    {!state.joined&&<Pressable style={s.button} disabled={busy||stale||remaining===0} onPress={()=>void join()}><Text style={s.buttonText}>{busy?'Confirming…':pendingEntry.current?'Check transaction again':'Sign to join'}</Text></Pressable>}
   </>}
   {(state.phase==='question'||state.phase==='result')&&<>
    <Text style={s.tag}>QUESTION {state.index+1}/10 · {remaining} sec</Text>
    <Text style={s.body}>{state.joined&&state.eliminatedAt===null?'You are playing':'You are watching'}</Text>
    <Text style={s.title}>{state.question?.text}</Text>
    {state.question?.options.map((option,i)=><Pressable key={i} disabled={busy||stale||remaining===0||state.phase!=='question'||!state.joined||state.eliminatedAt!==null||state.myChoice!==null} onPress={()=>void answer(i)} style={[s.option,(state.myChoice===i||state.leaders?.includes(i))&&{borderColor:'#D4FF62'}]}><Text style={s.body}>{option}{state.myChoice===i?' ✓':''}</Text>{state.counts&&<Text style={s.link}>{Math.round(state.counts[i]/Math.max(1,state.counts.reduce((a,b)=>a+b,0))*100)}%</Text>}</Pressable>)}
    {state.phase==='result'&&<Text style={s.link}>{state.eliminatedAt===null&&state.joined?'You advance ↗':'Stay and watch the game'}</Text>}
    {stale&&<Text style={s.error}>Reconnecting to the game. Answers are temporarily paused.</Text>}
   </>}
   {state.phase==='final'&&<><Text style={s.title}>Game over</Text><Text style={s.body}>{state.survivorCount} finalists split the prize pool. Any rounding remainder stays in the public wallet.</Text>{!state.payouts?.length&&<Text style={s.body}>No finalists this time. The prize pool stays in the wallet.</Text>}{state.payouts?.map(p=><View key={p.wallet} style={s.option}><Text style={s.body}>{p.wallet===address?'You':`${p.wallet.slice(0,4)}…${p.wallet.slice(-4)}`} · {sol(p.lamports)} SOL</Text>{p.status==='confirmed'&&p.signature?<Pressable onPress={()=>void Linking.openURL(explorer('tx',p.signature!))}><Text style={s.link}>View payout ↗</Text></Pressable>:<Text style={s.body}>Payout pending</Text>}</View>)}</>}
  </>}
 </View>;
}
const s=StyleSheet.create({panel:{backgroundColor:'#1D1F19',padding:20,borderRadius:20,gap:14},tag:{color:'#D4FF62',fontSize:11,letterSpacing:1},title:{color:'#F4F5E9',fontSize:26,fontWeight:'700'},body:{color:'#A5AB96',fontSize:14,lineHeight:21},error:{color:'#FFAD95',fontSize:14},link:{color:'#D4FF62',fontSize:14},button:{backgroundColor:'#D4FF62',padding:18,borderRadius:14},buttonText:{fontWeight:'700',color:'#11120F',textAlign:'center'},option:{borderWidth:1,borderColor:'#33362A',borderRadius:14,padding:16,gap:8}});
