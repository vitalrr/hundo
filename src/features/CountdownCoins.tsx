import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';

function Coin({ collected, index, reduceMotion }: { collected: boolean; index: number; reduceMotion: boolean }) {
 const progress = useRef(new Animated.Value(0)).current;
 useEffect(() => {
  if (reduceMotion) { progress.setValue(collected ? 1 : 0); return; }
  const animation = Animated.spring(progress, { toValue: collected ? 1 : 0, friction: 7, tension: 70, useNativeDriver: true });
  animation.start(); return () => animation.stop();
 }, [collected, reduceMotion, progress]);
 return <Animated.View style={[s.coin,{left:14+(index%5)*49+(Math.floor(index/5)%2)*8,top:8+Math.floor(index/5)*28,opacity:progress,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[-45,0]})},{scale:progress.interpolate({inputRange:[0,1],outputRange:[.35,1]})},{rotate:progress.interpolate({inputRange:[0,1],outputRange:[index%2?'35deg':'-35deg',index%2?'12deg':'-12deg']})}]}]}>
  {index%2===0?<Text style={s.coinText}>SKR</Text>:<View style={s.solMark}>{[0,1,2].map(i=><View key={i} style={[s.stripe,{backgroundColor:i===1?'#7047EB':'#9979DF',transform:[{skewX:'-20deg'}]}]}/>)}</View>}
 </Animated.View>;
}
export function CountdownCoins({seconds}:{seconds:number}) {
 const [reduceMotion,setReduceMotion]=useState(false);
 useEffect(()=>{let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(active)setReduceMotion(v);});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return()=>{active=false;listener.remove();};},[]);
 const collected=Math.max(0,Math.min(15,16-seconds));
 return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.pile}>{Array.from({length:15},(_,i)=><Coin key={i} index={i} collected={i<collected} reduceMotion={reduceMotion}/>)}</View>;
}
const s=StyleSheet.create({pile:{width:280,height:108,marginVertical:4},coin:{position:'absolute',width:42,height:42,borderRadius:21,borderWidth:2,borderColor:'#B697E9',backgroundColor:'#FAF6FF',alignItems:'center',justifyContent:'center'},coinText:{color:'#7047EB',fontWeight:'900',fontSize:11,letterSpacing:-.5},solMark:{gap:3},stripe:{height:4,width:19,borderRadius:1}});
