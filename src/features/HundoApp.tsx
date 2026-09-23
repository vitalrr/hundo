import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Buffer } from 'buffer';
import { useMobileWallet } from '../utils/useMobileWallet';
import { demoCounts, demoQuestions } from '../game/demo';
import { ANSWER_MS, QUESTION_MS, questionPhase, type Choice } from '../game/rules';
import { API_URL, ApiError, request, setSession } from '../services/api';
import { clearGameSession, loadGameSession, saveGameSession } from '../services/gameSession';
import { LiveRound } from './LiveRound';
import { Archive } from './Archive';
import { useHome } from '../services/useHome';
import { GameStage } from './GameStage';
import { WinnerResult } from './WinnerResult';
import { CrowdRecap } from './CrowdRecap';
import { RoundResults } from './RoundResults';
import { personalCrowdResult } from '../game/crowd';
import { SystemChrome } from './SystemChrome';
import { resultOutcome } from '../game/presentation';
import { getGamePushInstallationId, requestGamePushRegistration, subscribeToGameNotification } from '../services/gameNotifications';

type Screen = 'welcome' | 'lobby' | 'countdown' | 'play' | 'final' | 'practice' | 'results';
const letters = ['A', 'B', 'C', 'D'];
const C = { bg: '#E8FF79', panel: '#F7FFD9', border: '#B5C66D', text: '#202020', muted: '#4C5438', lime: '#7047EB', purple: '#7047EB', danger: '#B52C25' };
function Button({ title, onPress, secondary, disabled }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && { opacity: 0.5 }]}><Text style={[s.buttonText, secondary && { color: C.text }]}>{title}</Text></Pressable>;
}
export function HundoApp() {
  const wallet = useMobileWallet();
  const [screen, setScreen] = useState<Screen>('welcome');
  const home = useHome(screen === 'welcome' || screen === 'lobby');
  const nextRound = home.data?.round;
  const startDate = nextRound ? new Date(nextRound.startsAt) : null;
  const [address, setAddress] = useState('');
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveVisible, setLiveVisible] = useState(false);
  const [resultsRoundId, setResultsRoundId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoringSession, setRestoringSession] = useState(Platform.OS !== 'web' && Boolean(API_URL));
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [answers, setAnswers] = useState<Record<number, Choice>>({});
  const [eliminatedAt, setEliminatedAt] = useState<number | null>(null);
  const settled = useRef(new Set<number>());
  const answerRef = useRef(answers);
  const phase = questionPhase(now, startedAt);
  const q = demoQuestions[phase.index];
  const counts = [...demoCounts[phase.index]];
  if (answers[phase.index] !== undefined) counts[answers[phase.index]]++;
  const max = Math.max(...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const alive = eliminatedAt === null;
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    const subscription = AppState.addEventListener('change', () => setNow(Date.now()));
    return () => { clearInterval(id); subscription.remove(); };
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' || !API_URL) return;
    let active = true;
    void (async () => {
      try {
        const saved = await loadGameSession();
        if (!saved || !active) return;
        setSession(saved.token);
        try {
          const verified = await request<{ wallet: string }>('session');
          if (!active) return;
          if (verified.wallet !== saved.wallet) {
            setSession('');
            await clearGameSession();
            return;
          }
        } catch (error) {
          if (!active) return;
          if (error instanceof ApiError && error.status === 401) {
            setSession('');
            await clearGameSession();
            return;
          }
          // Keep the saved login through a temporary network outage.
        }
        if (active) { setAddress(saved.wallet); setScreen(current => current === 'results' ? current : 'lobby'); }
      } catch { setSession(''); }
      finally { if (active) setRestoringSession(false); }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!address || !API_URL) { setPushEnabled(null); return; }
    let stopped = false;
    void getGamePushInstallationId().then(installationId => request<{enabled:boolean}>('push-status', { installationId })).then(result => { if (!stopped) setPushEnabled(result.enabled); }).catch(() => { if (!stopped) setPushEnabled(false); });
    return () => { stopped = true; };
  }, [address]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    return subscribeToGameNotification((kind, roundId) => {
      if (kind === 'game-results') {
        setResultsRoundId(roundId);setLiveOpen(false);setScreen('results');
      } else {
        setScreen('lobby');setLiveOpen(true);
      }
    });
  }, []);
  useEffect(() => {
    if (screen === 'countdown' && now >= startedAt) { setScreen('play'); return; }
    if (screen !== 'play') return;
    for (let i = 0; i < 10; i++) {
      if (now < startedAt + i * QUESTION_MS + ANSWER_MS || settled.current.has(i)) continue;
      settled.current.add(i);
      const choice = answerRef.current[i];
      const votes = [...demoCounts[i]];
      if (choice !== undefined) votes[choice]++;
      if (choice === undefined || votes[choice] !== Math.max(...votes)) setEliminatedAt(previous => previous ?? i);
    }
    if (phase.phase === 'final') setScreen('final');
  }, [now, screen, startedAt, phase.phase]);
  function startDemo() {
    const start = Date.now() + 15000; settled.current.clear(); answerRef.current = {};
    setAnswers({}); setEliminatedAt(null); setStartedAt(start); setNow(Date.now()); setScreen('countdown');
  }
  function answer(choice: Choice) {
    const current = questionPhase(Date.now(), startedAt);
    if (!alive || answerRef.current[phase.index] !== undefined || current.phase !== 'question' || current.index !== phase.index) return;
    const next = { ...answerRef.current, [phase.index]: choice }; answerRef.current = next; setAnswers(next);
  }
  async function connect() {
    setBusy(true);
    try {
      const account = API_URL ? await wallet.connectAndSign(async publicKey => {
        const challenge = await request<{ id: string; message: string }>('challenge', { wallet: publicKey });
        return { message: Buffer.from(challenge.message, 'utf8'), id: challenge.id };
      }) : { account: await wallet.connect(), signedMessage: null, id: '' };
      const publicKey = account.account.publicKey.toBase58();
      if (account.signedMessage) {
        const verified = await request<{ token: string }>('authenticate', { id: account.id, signedMessage: Buffer.from(account.signedMessage).toString('base64') });
        setSession(verified.token);
        try { await saveGameSession({ wallet: publicKey, token: verified.token }); }
        catch { Alert.alert('Wallet connected', 'This phone could not save your session. You may need to connect again after closing hundo.'); }
      }
      setAddress(publicKey); setScreen('lobby');
    } catch (e) { Alert.alert('Connect wallet', e instanceof Error ? e.message : 'Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  async function setGameReminders(enabled: boolean) {
    if (!address || !API_URL) return;
    setPushBusy(true);
    try {
      const installationId = await getGamePushInstallationId();
      if (enabled) {
        const registration = await requestGamePushRegistration();
        await request('push-register', registration);
      } else {
        await request('push-disable', { installationId });
      }
      setPushEnabled(enabled);
    } catch (e) {
      Alert.alert(enabled ? 'Game reminders' : 'Game reminders off', e instanceof Error ? e.message : 'Could not update reminders.');
    } finally { setPushBusy(false); }
  }
  function leave() {
    if (Platform.OS === 'web' && (screen === 'play' || screen === 'countdown')) { if (window.confirm('Leave the demo? You can start again anytime.')) setScreen('lobby'); return; }
    if (screen === 'play' || screen === 'countdown') Alert.alert('Leave the demo?', 'You can start again anytime.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', onPress: () => setScreen('lobby') }]);
    else setScreen('lobby');
  }
  const recap=demoQuestions.map((q,number)=>{const votes=[...demoCounts[number]];if(answers[number]!==undefined)votes[answers[number]]++;return {...q,number,counts:votes,myChoice:answers[number]??null};});
  const won = alive && screen === 'final';
  const demoStage = screen === 'play' || screen === 'countdown';
  const spectator = !alive && !(phase.phase === 'result' && eliminatedAt === phase.index);
  return <View style={[s.safe,demoStage&&{backgroundColor:spectator?'#E7E7EF':'#EFE7FF'}]}><SystemChrome active={!liveVisible} color={demoStage?(spectator?'#E7E7EF':'#EFE7FF'):C.bg}/><SafeAreaView style={{flex:1,backgroundColor:'transparent'}}><StatusBar style="dark" />{demoStage?<GameStage phase={phase.phase} index={phase.index} seconds={Math.ceil(phase.remaining/1000)} remainingMs={phase.remaining} question={q} choice={answers[phase.index]??null} counts={phase.phase==='result'?counts:undefined} leaders={counts.flatMap((n,i)=>n===max?[i]:[])} alive={alive} joined outcome={resultOutcome(true,eliminatedAt,phase.index)} disabled={phase.phase!=='question'||!alive||answers[phase.index]!==undefined} demo onPreviewWinner={()=>{setEliminatedAt(null);setScreen('final');}} onAnswer={value=>answer(value as Choice)} onExit={leave}/>:screen==='results'?<RoundResults roundId={resultsRoundId} onBack={()=>setScreen('lobby')}/>:<ScrollView contentContainerStyle={s.page}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Go to home screen" onPress={leave}><Text style={s.wordmark}>hundo<Text style={{ color: C.purple }}>.</Text></Text></Pressable>{screen === 'final' && <Text style={s.pill}>DEMO</Text>}</View>
    {(screen === 'welcome' || screen === 'lobby') && <>
      <View style={s.homeHero}>
        <Text style={s.eyebrow}>{nextRound?.phase === 'live' ? 'GAME IN PROGRESS' : 'NEXT GAME'}</Text>
        <Text style={s.homeTime}>{nextRound?.phase === 'live' ? 'LIVE' : startDate ? startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : home.data ? 'SOON' : '—'}</Text>
        <Text style={s.scheduleNote}>{startDate ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · your local time` : home.error || (home.data ? 'The next game will be announced here' : 'Loading the next game…')}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={s.homePrize}>10 000 <Text style={s.homeUnit}>SKR</Text></Text>
        <Text style={s.daily}>SPLIT BY THOSE WHO READ THE CROWD</Text>
      </View>
      <View style={s.rulesPanel}>
        <Text style={s.rulesText}>Don't guess the answer. Guess the crowd.</Text>
        <View style={s.rulesDivider} />
        <View style={s.metricsRow}><Text style={s.rulesMetric}>10 questions</Text><Text style={s.metricsDot}>·</Text><Text style={s.rulesMetric}>15 seconds</Text></View>
      </View>
      <Text accessibilityLiveRegion="polite" style={s.waiting}>{nextRound ? nextRound.playerCount === 0 ? 'Be the first in the room' : `${nextRound.playerCount} ${nextRound.playerCount === 1 ? 'person' : 'people'} in the room` : home.data ? 'Be ready for the next game' : home.error ? 'Player count unavailable' : 'Checking who’s joining…'}</Text>
      {address ? <Text style={s.body}>● Wallet {address.slice(0, 5)}…{address.slice(-5)} connected · Devnet</Text> : <Button title={restoringSession ? 'Restoring wallet…' : busy ? 'Opening wallet…' : 'Connect wallet ↗'} onPress={connect} disabled={busy || restoringSession} />}
      {API_URL && address && pushEnabled !== null ? <Button title={pushBusy ? 'Updating reminders…' : pushEnabled ? 'Game reminders on · Turn off' : 'Get game reminders ↗'} onPress={()=>void setGameReminders(!pushEnabled)} secondary disabled={pushBusy} /> : null}
      {API_URL && address ? <Button title="Join the room ↗" onPress={()=>setLiveOpen(true)}/> : null}
      <Button title="See how it works ↗" onPress={()=>address&&API_URL?setScreen('practice'):startDemo()} secondary />
      <Text style={s.footnote}>{address&&API_URL?'Practice on a past crowd':'Practice with a demo crowd'}</Text>
      {API_URL ? <Button title="See the latest crowd ↗" onPress={()=>{setResultsRoundId(null);setScreen('results');}} secondary /> : null}
    </>}
    {won && <WinnerResult demo onHome={()=>setScreen('lobby')}/>}
    {screen === 'final' && !won && <>
      <Text style={s.eyebrow}>DEMO COMPLETE</Text><Text style={s.hero}>{won ? 'On the same\nwavelength.' : 'The crowd\nsurprised you.'}<Text style={{ color: C.lime }}>↗</Text></Text>
      <View style={s.card}><Text style={s.eyebrow}>{won ? 'YOU MADE THE FINAL' : 'YOUR RESULT'}</Text><Text style={s.large}>{won ? '10 / 10' : `${eliminatedAt ?? 0} / 10`}</Text><Text style={s.body}>{won ? 'In a live game, finalists split the prize pool equally.' : personalCrowdResult(recap[eliminatedAt??0])}</Text><View style={s.rule} /><Text style={s.body}>This is a demo. There are no cash prizes or payouts.</Text></View>
      <View style={s.spacer} /><Button title="Try again ↗" onPress={startDemo} /><Button title="Back to lobby" onPress={() => setScreen('lobby')} secondary />
    </>}
    {screen === 'final' && <CrowdRecap questions={recap} demo/>}
    {screen === 'practice' && <>
      <Text style={s.eyebrow}>BETWEEN GAMES</Text><Text style={s.title}>Read the{'\n'}room.</Text>{API_URL && address ? <Archive /> : <View style={s.card}><Text style={s.stat}>The first game is coming</Text><Text style={s.body}>Connect your wallet to replay past questions with recorded voting results once the first game ends.</Text></View>}<Text style={s.body}>Learn the rules in a demo. Its votes are simulated, not recorded from past games.</Text><View style={s.spacer} /><Button title="Play the demo ↗" onPress={startDemo} /><Button title="Back" onPress={() => setScreen('lobby')} secondary />
    </>}
    {busy && <ActivityIndicator color={C.lime} style={{ marginTop: 10 }} />}
  </ScrollView>}</SafeAreaView>{API_URL&&address?<LiveRound address={address} open={liveOpen} onClose={()=>setLiveOpen(false)} onTakeOver={()=>setScreen('lobby')} onVisibilityChange={setLiveVisible}/>:null}</View>;
}
const s = StyleSheet.create({
  daily: {color:C.purple,fontSize:10,fontWeight:'800',letterSpacing:1,textAlign:'center',lineHeight:15,marginTop:-4}, metricsRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:16,flexWrap:'wrap'}, metricsDot:{color:C.purple,fontSize:25,fontWeight:'900'},
  homeHero: { alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 20 }, homeTime: { color: C.text, fontSize: 58, fontWeight: '900', letterSpacing: -2, textAlign: 'center' }, scheduleNote: { color: C.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 240 }, homePrize: { color: C.purple, fontSize: 76, fontWeight: '900', letterSpacing: -4, textAlign: 'center', width: '100%', marginTop: 18 }, homeUnit: { fontSize: 32, letterSpacing: -1 }, rulesPanel: { backgroundColor: '#FFFFFF55', borderRadius: 24, padding: 22, gap: 18, marginBottom: 6 }, rulesText: { color: C.text, fontSize: 17, lineHeight: 24, textAlign: 'center', fontWeight: '500' }, rulesDivider: { height: 1, backgroundColor: '#20202014' }, rulesMetric: { color: C.muted, fontSize: 13, fontWeight: '600' }, waiting: { color: C.purple, fontSize: 15, fontWeight: '800', textAlign: 'center', marginVertical: 2 },
  prizeCard: { backgroundColor: C.purple, padding: 24, borderRadius: 20, gap: 12, marginVertical: 6 }, prizeLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 }, prizeAmount: { color: '#E8FF79', fontSize: 62, fontWeight: '900', letterSpacing: -2 }, prizeUnit: { fontSize: 28, letterSpacing: 0 }, prizeNote: { color: '#FFFFFF', fontSize: 12, lineHeight: 18 },
  safe: { flex: 1, backgroundColor: C.bg }, page: { flexGrow: 1, padding: 24, paddingTop: 12, gap: 14, maxWidth: 600, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, wordmark: { color: C.text, fontSize: 38, fontWeight: '900', letterSpacing: -2 }, badge: { flexDirection: 'row', gap: 7, alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 9 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.lime }, badgeText: { color: C.text, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  eyebrow: { color: C.muted, fontSize: 11, letterSpacing: 1.7, fontWeight: '700' }, hero: { color: C.text, fontSize: 49, lineHeight: 51, letterSpacing: -2.3, fontWeight: '900' }, title: { color: C.text, fontSize: 42, lineHeight: 46, fontWeight: '800', letterSpacing: -1.5 }, body: { color: C.muted, fontSize: 15, lineHeight: 23 },
  illustration: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 17, height: 175 }, tile: { width: 139, height: 116, borderRadius: 18, padding: 17 }, tileLabel: { fontSize: 9, letterSpacing: 1, color: C.bg, fontWeight: '800' }, tileNumber: { fontSize: 42, color: C.bg, fontWeight: '900', marginTop: 12 }, spacer: { flexGrow: 1, minHeight: 8 },
  button: { padding: 18, minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: C.lime, borderRadius: 16 }, buttonText: { color: C.bg, fontSize: 16, fontWeight: '800' }, secondary: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border }, footnote: { color: C.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  card: { padding: 24, backgroundColor: C.panel, borderRadius: 24, borderColor: C.border, borderWidth: 1, gap: 16, marginVertical: 8 }, large: { color: C.lime, fontSize: 50, fontWeight: '800', letterSpacing: -2 }, stat: { color: C.text, fontSize: 23, fontWeight: '700' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 }, rule: { height: 1, backgroundColor: C.border }, small: { color: C.muted, fontSize: 10, letterSpacing: 1, lineHeight: 16 }, pill: { color: C.lime, backgroundColor: C.panel, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, overflow: 'hidden', fontSize: 12 },
  progress: { flexDirection: 'row', gap: 5 }, segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border }, timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, timer: { fontSize: 45, color: C.lime, fontWeight: '800', fontVariant: ['tabular-nums'] }, question: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6, marginBottom: 12 },
  option: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }, selected: { borderColor: C.lime, borderWidth: 2 }, winner: { borderColor: C.lime }, letter: { color: C.muted, fontSize: 14, fontWeight: '700' }, optionText: { color: C.text, fontSize: 16, flex: 1, lineHeight: 21 }, percent: { color: C.text, fontSize: 16, fontWeight: '800' }, fill: { position: 'absolute', top: 0, bottom: 0, left: 0 }, status: { gap: 8, paddingVertical: 12 }, statusTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
