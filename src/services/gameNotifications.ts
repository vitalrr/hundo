import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

export const GAME_CHANNEL='hundo-games';
const DEVICE_ID_KEY='hundo-notification-installation';
const DEVICE_SECRET_KEY='hundo-notification-secret';
const REMINDER_CHOICE_KEY='hundo-reminder-choice';

if(Platform.OS==='android'){
 Notifications.setNotificationHandler({
  handleNotification:async()=>({shouldShowAlert:true,shouldPlaySound:true,shouldSetBadge:false}),
 });
}

export async function getGamePushInstallationId(){
 let installationId=await AsyncStorage.getItem(DEVICE_ID_KEY);
 if(!installationId){installationId=Crypto.randomUUID();await AsyncStorage.setItem(DEVICE_ID_KEY,installationId);}
 return installationId;
}

export async function getGamePushDeviceCredentials(){
 const installationId=await getGamePushInstallationId();
 let deviceSecret=await SecureStore.getItemAsync(DEVICE_SECRET_KEY);
 if(!deviceSecret){
  deviceSecret=Array.from(Crypto.getRandomBytes(32),byte=>byte.toString(16).padStart(2,'0')).join('');
  await SecureStore.setItemAsync(DEVICE_SECRET_KEY,deviceSecret);
 }
 return {installationId,deviceSecret};
}

export async function getReminderChoice(){
 return await AsyncStorage.getItem(REMINDER_CHOICE_KEY);
}

export async function saveReminderChoice(enabled:boolean){
 await AsyncStorage.setItem(REMINDER_CHOICE_KEY,enabled?'on':'off');
}

// FCM credentials are configured in the native Android build, never here.
// Android asks for notification permission when needed. A wallet is not required.
export async function requestGamePushRegistration(){
 if(Platform.OS!=='android')throw new Error('Enable game reminders in the Android app.');
 await Notifications.setNotificationChannelAsync(GAME_CHANNEL,{
  name:'Game reminders',importance:Notifications.AndroidImportance.HIGH,
  sound:'default',vibrationPattern:[0,180,100,180],lightColor:'#7047EB',
 });
 let permission=await Notifications.getPermissionsAsync();
 if(!permission.granted&&permission.canAskAgain)permission=await Notifications.requestPermissionsAsync();
 if(!permission.granted)throw new Error('Allow notifications in Android settings to receive game reminders.');
 const nativeToken=await Notifications.getDevicePushTokenAsync();
 if(typeof nativeToken.data!=='string')throw new Error('Could not register this phone. Please try again.');
 const credentials=await getGamePushDeviceCredentials();
 return {...credentials,token:nativeToken.data};
}

export function subscribeToGameNotification(onOpen:(kind:'game-reminder'|'game-results',roundId:string)=>void){
 let mounted=true;
 const seen=new Set<string>();
 const handle=(response:Notifications.NotificationResponse|null)=>{
  if(!mounted||!response)return;
  const request=response.notification.request;
  const data=request.content.data;
  if((data.kind!=='game-reminder'&&data.kind!=='game-results')||typeof data.roundId!=='string'||! /^[0-9a-f-]{36}$/i.test(data.roundId)||seen.has(request.identifier))return;
  seen.add(request.identifier);onOpen(data.kind,data.roundId);
  void Notifications.clearLastNotificationResponseAsync().catch(()=>{});
 };
 const listener=Notifications.addNotificationResponseReceivedListener(handle);
 void Notifications.getLastNotificationResponseAsync().then(handle).catch(()=>{});
 return()=>{mounted=false;listener.remove();};
}
