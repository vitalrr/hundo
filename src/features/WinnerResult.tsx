import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CountdownCoins } from './CountdownCoins';
import { useRoundAudio } from '../game/useRoundAudio';

type Props = {
  demo?: boolean; rehearsal?: boolean; finalists?: number; players?: number;
  payout?: {lamports: string; status: string; signature: string | null};
  onHome: () => void;
};
export function WinnerResult({demo, rehearsal, finalists, players, payout, onHome}: Props) {
  const [sound, setSound] = useState(true);
  useRoundAudio('result', 10, 0, 'correct', sound);
  const amount = demo ? '50' : payout ? (Number(payout.lamports) / 1e9).toLocaleString('en-US', {maximumFractionDigits:9}) : null;
  return <View style={s.root}>
    <View style={s.row}><Text style={s.label}>{demo?'DEMO · WINNER PREVIEW':rehearsal?'REHEARSAL COMPLETE':'ROUND COMPLETE'}</Text><Pressable accessibilityRole="button" onPress={()=>setSound(v=>!v)}><Text style={s.link}>{sound?'SOUND ON':'SOUND OFF'}</Text></Pressable></View>
    <Text accessibilityRole="header" style={s.title}>YOU{ '\n' }WON!</Text>
    <Text style={s.subtitle}>You knew what the crowd was thinking. 10 times in a row.</Text>
    <CountdownCoins seconds={0}/>
    <View style={s.score}><Text style={s.scoreText}>10 / 10</Text><Text style={s.label}>QUESTIONS SURVIVED</Text></View>
    <View style={s.card}>
      <Text style={s.label}>{demo?'EXAMPLE PRIZE':rehearsal?'YOU MADE THE FINAL':'YOUR PRIZE · DEVNET'}</Text>
      {amount!==null&&!rehearsal?<Text adjustsFontSizeToFit numberOfLines={1} style={s.amount}>{amount} <Text style={s.unit}>{demo?'SKR':'SOL'}</Text></Text>:<Text style={s.scoreText}>{rehearsal?'Perfect instinct.':'Calculating your share…'}</Text>}
      <Text style={s.body}>{demo?'1 000 SKR shared by 20 winners.':`${finalists ?? 0} finalists out of ${players ?? 0} players.`}</Text>
      <Text style={s.body}>{demo?'Demo example only — no prize or payment.':rehearsal?'A practice victory. No payouts are sent.':payout?.status==='confirmed'&&payout.signature?'Payment confirmed on Solana.':'Payment has not been confirmed yet.'}</Text>
      {!demo&&!rehearsal&&payout?.status==='confirmed'&&payout.signature?<Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(`https://explorer.solana.com/tx/${payout.signature}?cluster=devnet`)}><Text style={s.link}>View payout ↗</Text></Pressable>:null}
    </View>
    <Pressable accessibilityRole="button" style={s.button} onPress={onHome}><Text style={s.buttonText}>Back to home ↗</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({root:{gap:16,alignItems:'center',width:'100%'},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,width:'100%'},label:{fontSize:10,fontWeight:'800',letterSpacing:1,color:'#514063'},link:{color:'#5932C5',fontWeight:'800',fontSize:11},title:{fontSize:76,lineHeight:76,fontWeight:'900',letterSpacing:-4,color:'#7047EB',textAlign:'center',marginTop:10},subtitle:{color:'#202020',fontSize:17,textAlign:'center'},score:{alignItems:'center',gap:5},scoreText:{fontSize:30,fontWeight:'900',color:'#202020',textAlign:'center'},card:{alignItems:'center',gap:12,padding:22,borderRadius:26,backgroundColor:'#FFFFFF99',width:'100%'},amount:{fontSize:62,fontWeight:'900',letterSpacing:-2,color:'#7047EB'},unit:{fontSize:28,letterSpacing:0},body:{fontSize:14,lineHeight:21,color:'#514063',textAlign:'center'},button:{backgroundColor:'#7047EB',borderRadius:18,padding:19,width:'100%',alignItems:'center',marginTop:4},buttonText:{fontSize:16,fontWeight:'800',color:'#E8FF79'}});
