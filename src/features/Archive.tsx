import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { request } from '../services/api';
type RecordedQuestion={number:number;text:string;options:string[];counts:number[];leaders:number[]};
export function Archive(){
 const [questions,setQuestions]=useState<RecordedQuestion[]>([]);const [date,setDate]=useState('');const [index,setIndex]=useState(0);const [choice,setChoice]=useState<number|null>(null);const [message,setMessage]=useState('Loading past games…');
 useEffect(()=>{let cancelled=false;request<{round:{starts_at:string}|null;questions?:RecordedQuestion[]}>('archive').then(data=>{if(cancelled)return;if(!data.round){setMessage('No past games yet. The first game is coming.');return;}setDate(new Date(data.round.starts_at).toLocaleDateString('en-US'));setQuestions(data.questions??[]);setMessage('');}).catch(e=>{if(!cancelled)setMessage(e.message);});return()=>{cancelled=true;};},[]);
 const q=questions[index];
 if(!q)return <Text style={{color:'#4C5438',lineHeight:23}}>{message}</Text>;
 const total=q.counts.reduce((a,b)=>a+b,0);
 return <View style={{gap:14}}><Text style={{color:'#7047EB'}}>Game {date} · {index+1}/{questions.length}</Text><Text style={{color:'#202020',fontSize:25,fontWeight:'700'}}>{q.text}</Text>{q.options.map((option,i)=><Pressable key={i} disabled={choice!==null} onPress={()=>setChoice(i)} style={{padding:18,borderRadius:14,borderWidth:1,borderColor:choice!==null&&q.leaders.includes(i)?'#7047EB':'#B5C66D',backgroundColor:'#F7FFD9'}}><Text style={{color:'#202020',fontSize:16}}>{option}{choice!==null?` · ${Math.round(q.counts[i]/Math.max(1,total)*100)}%`:''}{choice===i?' ✓':''}</Text></Pressable>)}{choice!==null&&<><Text style={{color:'#4C5438'}}>Recorded results from a past game. {q.leaders.includes(choice)?'You read the room.':'Most players picked another answer.'}</Text><Pressable onPress={()=>{setIndex((index+1)%questions.length);setChoice(null);}} style={{padding:18,backgroundColor:'#7047EB',borderRadius:14}}><Text style={{color:'#FFFFFF',fontWeight:'700',textAlign:'center'}}>{index===questions.length-1?'Start again':'Next question ↗'}</Text></Pressable></>}</View>;
}
