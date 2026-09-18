import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { request } from '../services/api';
type RecordedQuestion={number:number;text:string;options:string[];counts:number[];leaders:number[]};
export function Archive(){
 const [questions,setQuestions]=useState<RecordedQuestion[]>([]);const [date,setDate]=useState('');const [index,setIndex]=useState(0);const [choice,setChoice]=useState<number|null>(null);const [message,setMessage]=useState('Загружаем архив…');
 useEffect(()=>{let cancelled=false;request<{round:{starts_at:string}|null;questions?:RecordedQuestion[]}>('archive').then(data=>{if(cancelled)return;if(!data.round){setMessage('Архив пуст: первый эфир ещё впереди.');return;}setDate(new Date(data.round.starts_at).toLocaleDateString('ru-RU'));setQuestions(data.questions??[]);setMessage('');}).catch(e=>{if(!cancelled)setMessage(e.message);});return()=>{cancelled=true;};},[]);
 const q=questions[index];
 if(!q)return <Text style={{color:'#A5AB96',lineHeight:23}}>{message}</Text>;
 const total=q.counts.reduce((a,b)=>a+b,0);
 return <View style={{gap:14}}><Text style={{color:'#D4FF62'}}>Эфир {date} · {index+1}/{questions.length}</Text><Text style={{color:'#F4F5E9',fontSize:25,fontWeight:'700'}}>{q.text}</Text>{q.options.map((option,i)=><Pressable key={i} disabled={choice!==null} onPress={()=>setChoice(i)} style={{padding:18,borderRadius:14,borderWidth:1,borderColor:choice!==null&&q.leaders.includes(i)?'#D4FF62':'#33362A',backgroundColor:'#1D1F19'}}><Text style={{color:'#F4F5E9',fontSize:16}}>{option}{choice!==null?` · ${Math.round(q.counts[i]/Math.max(1,total)*100)}%`:''}{choice===i?' ✓':''}</Text></Pressable>)}{choice!==null&&<><Text style={{color:'#A5AB96'}}>Настоящие результаты завершённого эфира. {q.leaders.includes(choice)?'Чутьё не подвело.':'Толпа выбрала иначе.'}</Text><Pressable onPress={()=>{setIndex((index+1)%questions.length);setChoice(null);}} style={{padding:18,backgroundColor:'#D4FF62',borderRadius:14}}><Text style={{color:'#11120F',fontWeight:'700',textAlign:'center'}}>{index===questions.length-1?'Начать заново':'Следующий вопрос ↗'}</Text></Pressable></>}</View>;
}
