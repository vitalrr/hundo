import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { answerTone, type StagePhase } from '../game/presentation';
import { useRoundAudio } from '../game/useRoundAudio';
import { CountdownCoins } from './CountdownCoins';

type Props = {
 phase: StagePhase; index: number; seconds: number; remainingMs: number;
 question?: { text: string; options: readonly string[] };
 choice: number | null; counts?: number[]; leaders?: number[];
 alive: boolean; joined: boolean; outcome: 'correct' | 'out' | 'spectator';
 disabled?: boolean; pending?: boolean; error?: string; stale?: boolean;
 demo?: boolean; playerCount?: number; survivorCount?: number;
 onAnswer: (choice: number) => void; onExit: () => void;
};
const purple = '#7047EB', red = '#D72C42', ink = '#202020';
export function GameStage(p: Props) {
 const [sound, setSound] = useState(true);
 const scale = useRef(new Animated.Value(1)).current;
 const audioState = useRoundAudio(p.phase, p.index, p.seconds, p.outcome, sound && !p.stale && p.outcome !== 'spectator');
 useEffect(() => {
  if (p.phase !== 'lobby' && (p.phase !== 'question' || p.seconds > 3)) return;
  scale.setValue(1.08);
  const animation = Animated.timing(scale, { toValue: 1, duration: 250, useNativeDriver: true });
  animation.start(); return () => animation.stop();
 }, [p.phase, p.seconds, scale]);
 const revealed = p.phase === 'result';
 const total = p.counts?.reduce((sum, n) => sum + n, 0) || 1;
 const urgent = p.phase === 'question' && p.seconds <= 3;
 const footer = <View style={s.footer}><Text style={s.note}>{p.demo ? 'DEMO · Simulated votes' : `${p.playerCount ?? 0} joined · ${p.survivorCount ?? 0} still playing`}</Text><Pressable accessibilityRole="button" onPress={p.onExit}><Text style={s.exit}>Leave game</Text></Pressable></View>;
 const controls = <View style={s.header}><Text style={s.logo}>hundo<Text style={{color:purple}}>.</Text></Text><Pressable accessibilityRole="button" accessibilityLabel={sound?'Mute game audio':'Enable game audio'} onPress={()=>setSound(v=>!v)} style={s.sound}><Text style={s.soundText}>{!sound?'SOUND OFF':audioState==='loading'?'LOADING SOUND':audioState==='unavailable'?'SOUND UNAVAILABLE':'SOUND ON'}</Text></Pressable></View>;
 if (p.phase === 'lobby') return <ScrollView contentContainerStyle={s.page}>
  {controls}<View style={s.countdownCenter}><Text style={s.kicker}>GET READY</Text><Animated.View style={[s.countdownBox,{transform:[{scale}]}]}><Text allowFontScaling={false} style={s.countdown}>{p.seconds > 0 ? p.seconds : 'GO'}</Text></Animated.View><CountdownCoins seconds={p.seconds}/><Text style={s.countdownTitle}>{p.joined?'You’re in. Trust your instinct.':'Watch the game live.'}</Text><Text style={s.note}>{p.stale?'Reconnecting to the game…':p.seconds===0?'Waiting for the first question…':'The game is about to begin'}</Text></View>{footer}
 </ScrollView>;
 return <ScrollView contentContainerStyle={s.page}>
  {controls}
  {p.outcome==='spectator'&&<View style={s.spectatorBanner}><Text style={s.spectatorTitle}>YOU’RE WATCHING</Text><Text style={s.spectatorNote}>Your run is over. See who makes the final.</Text></View>}
  <View style={s.row}><Text style={s.kicker}>QUESTION {String(p.index+1).padStart(2,'0')} / 10</Text><Text style={s.badge}>{p.alive&&p.joined?'● PLAYING':'◉ WATCHING'}</Text></View>
  <View style={s.progress}>{Array.from({length:10},(_,i)=><View key={i} style={[s.segment,i<=p.index&&{backgroundColor:purple}]}/>)}</View>
  <View style={[s.row,s.timerRow]}><Animated.View style={[s.digits,{transform:[{scale}]}]}><Text allowFontScaling={false} style={[s.timer,urgent&&{color:red}]}>{String(p.seconds).padStart(2,'0')}</Text><Text style={s.seconds}>sec</Text></Animated.View><Text style={s.prompt}>{revealed?'NEXT QUESTION\nIN':'TRUST YOUR\nFIRST INSTINCT'}</Text></View>
  <View style={s.timeTrack}><View style={[s.timeFill,{width:`${Math.max(0,Math.min(100,p.remainingMs/(revealed?5000:10000)*100))}%`,backgroundColor:urgent?red:purple}]}/></View>
  <Text style={s.question}>{p.question?.text ?? 'Loading question…'}</Text>
  {p.question?.options.map((option,i)=>{
   const tone=answerTone(p.choice,i,revealed,p.leaders??[]);
   const colored=tone==='majority'||tone==='wrong';
    return <Pressable key={`${p.index}:${i}`} accessibilityRole="button" accessibilityState={{selected:p.choice===i,disabled:!!p.disabled}} disabled={p.disabled} onPress={()=>p.onAnswer(i)} style={[s.option,p.outcome==='spectator'&&!revealed&&s.spectatorOption,tone==='selected'&&s.selected,tone==='majority'&&s.majority,tone==='wrong'&&s.wrong]}>
    <Text style={[s.letter,colored&&s.white]}>{'ABCD'[i]}</Text><Text style={[s.optionText,colored&&s.white]}>{option}</Text>
    {revealed?<View style={s.answerEnd}><Text style={[s.percent,colored&&s.white]}>{Math.round((p.counts?.[i]??0)/total*100)}%</Text><Text style={[s.mark,colored&&s.white]}>{tone==='majority'?'✓ MOST PICKED':tone==='wrong'?'✕ YOUR PICK':p.choice===i?'YOUR PICK':''}</Text></View>:p.choice===i?<Text style={{color:purple,fontWeight:'900'}}>✓</Text>:null}
   </Pressable>;
  })}
  {revealed?<View accessibilityLiveRegion="polite" style={[s.result,{backgroundColor:p.outcome==='out'?red:p.outcome==='correct'?purple:'#FFFFFF99'}]}><Text style={[s.resultTitle,p.outcome!=='spectator'&&s.white]}>{p.outcome==='correct'?'YOU’RE THROUGH! ↗':p.outcome==='out'?'YOU’RE OUT':'WATCH THE MAJORITY'}</Text><Text style={[s.resultNote,p.outcome!=='spectator'&&s.white]}>{p.outcome==='correct'?'You picked the majority.':p.outcome==='out'?(p.choice===null?'No answer in time. Stay and watch.':(p.leaders??[]).includes(p.choice)?'Right pick, but outside the speed cutoff.':'Your answer wasn’t the majority. Stay and watch.'):'See what the remaining players picked.'}</Text></View>:<Text style={s.locked}>{p.stale?'Reconnecting — answers paused':p.pending?'Sending your answer…':!p.alive||!p.joined?'You’re watching this game':p.choice!==null?'✓ Answer locked':'Pick before the timer runs out'}</Text>}
  {!!p.error&&<Text accessibilityLiveRegion="polite" style={s.error}>{p.error}</Text>}
  {footer}
 </ScrollView>;
}
const s=StyleSheet.create({
 spectatorBanner:{backgroundColor:'#DAD2EB',borderRadius:18,padding:18,gap:6},spectatorTitle:{color:'#55358A',fontSize:24,fontWeight:'900'},spectatorNote:{color:'#584D68',fontSize:13,lineHeight:18},spectatorOption:{backgroundColor:'#E1DFE8',borderColor:'#C7C1D3'},
 timerRow:{minHeight:112,paddingVertical:6,overflow:'visible'},digits:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:6,overflow:'visible'},countdownBox:{minHeight:204,width:'100%',alignItems:'center',justifyContent:'center',paddingVertical:10,overflow:'visible'},
 page:{flexGrow:1,width:'100%',maxWidth:600,alignSelf:'center',padding:22,paddingTop:12,gap:12},
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},logo:{fontSize:32,fontWeight:'900',letterSpacing:-1.8,color:ink},sound:{padding:10,borderRadius:18,backgroundColor:'#FFFFFF99'},soundText:{fontSize:10,fontWeight:'800',color:purple},
 row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},kicker:{fontSize:11,fontWeight:'800',letterSpacing:1.5,color:'#625975'},badge:{fontSize:11,fontWeight:'800',color:purple},
 progress:{flexDirection:'row',gap:5},segment:{flex:1,height:5,borderRadius:3,backgroundColor:'#C8BCDE'},timer:{fontSize:72,lineHeight:94,includeFontPadding:false,fontWeight:'900',letterSpacing:-3,color:purple,fontVariant:['tabular-nums']},seconds:{fontSize:16,fontWeight:'700',color:purple,letterSpacing:0},prompt:{fontSize:10,lineHeight:16,letterSpacing:1,color:'#625975'},timeTrack:{height:6,borderRadius:3,overflow:'hidden',backgroundColor:'#FFFFFF88'},timeFill:{height:'100%'},
 question:{fontSize:27,lineHeight:32,fontWeight:'800',letterSpacing:-.6,color:ink,marginVertical:6},option:{minHeight:66,padding:14,borderRadius:17,borderWidth:2,borderColor:'#C8BCDE',backgroundColor:'#FAF7FF',flexDirection:'row',alignItems:'center',gap:10},selected:{borderColor:purple,backgroundColor:'#DFD2FF'},majority:{backgroundColor:purple,borderColor:purple},wrong:{backgroundColor:red,borderColor:red},white:{color:'#FFFFFF'},letter:{fontSize:13,fontWeight:'800',color:'#625975'},optionText:{flex:1,color:ink,fontSize:16,fontWeight:'600',lineHeight:21},answerEnd:{alignItems:'flex-end',gap:3},percent:{fontSize:20,fontWeight:'900',color:ink},mark:{fontSize:8,fontWeight:'800',color:'#625975'},
 result:{borderRadius:18,padding:18,gap:5},resultTitle:{fontSize:21,fontWeight:'900',color:purple},resultNote:{fontSize:13,lineHeight:18,color:ink},locked:{color:purple,fontSize:15,fontWeight:'700',textAlign:'center',paddingVertical:10},error:{color:red,textAlign:'center',fontSize:13},footer:{marginTop:'auto',paddingTop:14,gap:10,alignItems:'center'},note:{color:'#625975',fontSize:12,textAlign:'center',lineHeight:18},exit:{fontSize:12,color:'#625975',textDecorationLine:'underline',padding:8},countdownCenter:{flex:1,justifyContent:'center',alignItems:'center',minHeight:400,gap:16},countdown:{fontSize:150,lineHeight:184,includeFontPadding:false,fontWeight:'900',letterSpacing:-8,color:purple,fontVariant:['tabular-nums']},countdownTitle:{fontSize:22,lineHeight:28,textAlign:'center',fontWeight:'800',color:ink},
});
