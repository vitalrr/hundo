import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

export function SystemChrome({color,active=true}:{color:string;active?:boolean}) {
 useEffect(()=>{
  if(Platform.OS!=='android'||!active)return;
  void NavigationBar.setBackgroundColorAsync(color).catch(()=>{});
  void NavigationBar.setButtonStyleAsync('dark').catch(()=>{});
 },[color,active]);
 return null;
}
