import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {crowdResult,type CrowdQuestion} from '../game/crowd';
export function CrowdRecap({questions,demo=false}:{questions:CrowdQuestion[];demo?:boolean}){
 return <View style={s.root}><Text accessibilityRole="header" style={s.title}>Today the crowd believes:</Text><Text style={s.note}>{demo?'Demo crowd · simulated votes':'This room’s choices · not a survey of everyone'}</Text>{questions.map(q=><View key={q.number} style={s.item}><Text style={s.question}>{q.number+1}. {q.text}</Text><Text style={s.answer}>{crowdResult(q).text}</Text></View>)}</View>;
}
const s=StyleSheet.create({root:{gap:16,paddingVertical:20,width:'100%'},title:{fontSize:30,lineHeight:35,fontWeight:'900',color:'#7047EB',letterSpacing:-1},note:{fontSize:12,lineHeight:17,color:'#514063'},item:{gap:7,borderBottomWidth:1,borderBottomColor:'#7047EB22',paddingBottom:15},question:{fontSize:14,lineHeight:20,color:'#514063'},answer:{fontSize:18,lineHeight:25,fontWeight:'700',color:'#202020'}});
