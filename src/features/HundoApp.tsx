import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Buffer } from 'buffer';
import { useMobileWallet } from '../utils/useMobileWallet';
import { demoCounts, demoQuestions } from '../game/demo';
import { questionPhase, type Choice } from '../game/rules';
import { API_URL, request, setSession } from '../services/api';
import { LiveRound } from './LiveRound';
import { Archive } from './Archive';

type Screen = 'welcome' | 'lobby' | 'play' | 'final' | 'practice';
const letters = ['A', 'B', 'C', 'D'];
const C = { bg: '#E8FF79', panel: '#F7FFD9', border: '#B5C66D', text: '#202020', muted: '#4C5438', lime: '#7047EB', purple: '#7047EB', danger: '#B52C25' };
function Button({ title, onPress, secondary, disabled }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && { opacity: 0.5 }]}><Text style={[s.buttonText, secondary && { color: C.text }]}>{title}</Text></Pressable>;
}
export function HundoApp() {
  const wallet = useMobileWallet();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
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
    if (screen !== 'play') return;
    for (let i = 0; i < 10; i++) {
      if (now < startedAt + i * 15000 + 10000 || settled.current.has(i)) continue;
      settled.current.add(i);
      const choice = answerRef.current[i];
      const votes = [...demoCounts[i]];
      if (choice !== undefined) votes[choice]++;
      if (choice === undefined || votes[choice] !== Math.max(...votes)) setEliminatedAt(previous => previous ?? i);
    }
    if (phase.phase === 'final') setScreen('final');
  }, [now, screen, startedAt, phase.phase]);
  function startDemo() {
    const start = Date.now(); settled.current.clear(); answerRef.current = {};
    setAnswers({}); setEliminatedAt(null); setStartedAt(start); setNow(start); setScreen('play');
  }
  function answer(choice: Choice) {
    const current = questionPhase(Date.now(), startedAt);
    if (!alive || answerRef.current[phase.index] !== undefined || current.phase !== 'question' || current.index !== phase.index) return;
    const next = { ...answerRef.current, [phase.index]: choice }; answerRef.current = next; setAnswers(next);
  }
  async function connect() {
    setBusy(true);
    try {
      const account = await wallet.connect();
      const publicKey = account.publicKey.toBase58();
      if (API_URL) {
        const challenge = await request<{ id: string; message: string }>('challenge', { wallet: publicKey });
        const signed = await wallet.signMessage(Buffer.from(challenge.message, 'utf8'));
        const verified = await request<{ token: string }>('authenticate', { id: challenge.id, signedMessage: Buffer.from(signed).toString('base64') });
        setSession(verified.token);
      }
      setAddress(publicKey); setScreen('lobby');
    } catch (e) { Alert.alert('Подключение кошелька', e instanceof Error ? e.message : 'Не удалось подключиться. Попробуй ещё раз.'); }
    finally { setBusy(false); }
  }
  function leave() {
    if (screen === 'play') Alert.alert('Выйти из демораунда?', 'Можно начать заново в любой момент.', [{ text: 'Остаться', style: 'cancel' }, { text: 'Выйти', onPress: () => setScreen('lobby') }]);
    else setScreen('lobby');
  }
  const won = alive && screen === 'final';
  return <SafeAreaView style={s.safe}><Image source={require('../../assets/home-gradient.png')} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]} resizeMode="stretch" accessible={false} /><StatusBar style="dark" /><ScrollView contentContainerStyle={s.page}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="На главный экран" onPress={leave}><Text style={s.wordmark}>hundo<Text style={{ color: C.purple }}>.</Text></Text></Pressable>{(screen === 'play' || screen === 'final') && <Text style={s.pill}>ДЕМО</Text>}</View>
    {(screen === 'welcome' || screen === 'lobby') && <>
      <View style={s.homeHero}>
        <Text style={s.eyebrow}>NEXT GAME</Text>
        <Text style={s.homeTime}>12:00</Text>
        <Text style={s.scheduleNote}>Every day · your local time</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={s.homePrize}>10 000 <Text style={s.homeUnit}>SKR</Text></Text>
      </View>
      <View style={s.rulesPanel}>
        <Text style={s.rulesText}>Pick the answer most players will choose.</Text>
        <View style={s.rulesDivider} />
        <View style={s.row}><Text style={s.rulesMetric}>10 questions</Text><Text style={s.rulesMetric}>10 seconds</Text></View>
      </View>
      <Text style={s.waiting}>37 players are already waiting</Text>
      {address ? <Text style={s.body}>● Wallet {address.slice(0, 5)}…{address.slice(-5)} connected · Devnet</Text> : <Button title={busy ? 'Opening wallet…' : 'Connect wallet ↗'} onPress={connect} disabled={busy} />}
      {API_URL && address ? <LiveRound address={address} /> : null}
      <Button title="See how it works ↗" onPress={startDemo} secondary />
      <Text style={s.footnote}>A quick walkthrough of the game.</Text>
    </>}
    {screen === 'play' && <>
      <View style={s.row}><Text style={s.eyebrow}>QUESTION {String(phase.index + 1).padStart(2, '0')} / 10</Text><Text style={[s.pill, !alive && { color: C.purple }]}>{alive ? '● PLAYING' : '◉ SPECTATOR'}</Text></View>
      <View style={s.progress}>{Array.from({ length: 10 }, (_, i) => <View key={i} style={[s.segment, i <= phase.index && { backgroundColor: C.lime }]} />)}</View>
      <View style={s.timerRow}><Text style={[s.timer, phase.remaining < 3000 && phase.phase === 'question' && { color: C.danger }]}>{Math.ceil(phase.remaining / 1000).toString().padStart(2, '0')}<Text style={s.body}> sec</Text></Text><Text style={s.small}>{phase.phase === 'question' ? 'WHAT WILL MOST\nPLAYERS PICK?' : 'NEXT QUESTION\nIN'}</Text></View>
      <Text style={s.question}>{q.text}</Text>
      {q.options.map((option, i) => {
        const selected = answers[phase.index] === i, revealed = phase.phase === 'result', winner = counts[i] === max;
        return <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected, disabled: revealed || !alive || answers[phase.index] !== undefined }} onPress={() => answer(i as Choice)} disabled={revealed || !alive || answers[phase.index] !== undefined} style={[s.option, selected && s.selected, revealed && winner && s.winner]}>
          {revealed && <View style={[s.fill, { width: `${Math.round(counts[i] / total * 100)}%`, backgroundColor: winner ? '#D4FF6222' : '#FFFFFF08' }]} />}
          <Text style={[s.letter, (selected || revealed && winner) && { color: C.lime }]}>{letters[i]}</Text><Text style={s.optionText}>{option}</Text>{revealed ? <Text style={s.percent}>{Math.round(counts[i] / total * 100)}%</Text> : selected && <Text style={{ color: C.lime }}>✓</Text>}
        </Pressable>;
      })}
      <View accessibilityLiveRegion="polite" style={s.status}><Text style={[s.statusTitle, { color: C.purple }]}>{phase.phase === 'result' ? alive ? 'You picked the majority ↗' : 'You are now watching' : !alive ? 'Watch what players choose' : answers[phase.index] !== undefined ? 'Answer locked. Waiting for others.' : 'Trust your first instinct.'}</Text><Text style={s.footnote}>{phase.phase === 'result' ? 'Demo votes, not real players.' : 'Answers stay hidden until the timer ends.'}</Text></View>
      <View style={s.spacer} /><Text style={s.footnote}>ДЕМО · Без денежных призов · <Text onPress={leave} style={{ textDecorationLine: 'underline' }}>Выйти</Text></Text>
    </>}
    {screen === 'final' && <>
      <Text style={s.eyebrow}>ДЕМОРАУНД ЗАВЕРШЁН</Text><Text style={s.hero}>{won ? 'На одной\nволне.' : 'Ещё\nпопробуем!'}<Text style={{ color: C.lime }}>↗</Text></Text>
      <View style={s.card}><Text style={s.eyebrow}>{won ? 'ТЫ ДОШЁЛ ДО ФИНАЛА' : 'ТВОЙ РЕЗУЛЬТАТ'}</Text><Text style={s.large}>{won ? '10 / 10' : `${eliminatedAt ?? 0} / 10`}</Text><Text style={s.body}>{won ? 'В настоящем эфире финалисты делят банк поровну.' : `Выбывание на вопросе ${(eliminatedAt ?? 0) + 1}. Завтра — ещё один шанс почувствовать большинство.`}</Text><View style={s.rule} /><Text style={s.body}>Это демо: денежного банка и транзакций выплат здесь нет.</Text></View>
      <View style={s.spacer} /><Button title="Попробовать ещё раз ↗" onPress={startDemo} /><Button title="В комнату ожидания" onPress={() => setScreen('lobby')} secondary />
    </>}
    {screen === 'practice' && <>
      <Text style={s.eyebrow}>МЕЖДУ ЭФИРАМИ</Text><Text style={s.title}>Поймай{'\n'}настроение.</Text>{API_URL && address ? <Archive /> : <View style={s.card}><Text style={s.stat}>Первый эфир впереди</Text><Text style={s.body}>Здесь появятся вопросы прошлого раунда с настоящими процентами ответов после подключения сервера и кошелька.</Text></View>}<Text style={s.body}>Можешь освоить механику в демораунде. Его результаты смоделированы и не относятся к прошлым эфирам.</Text><View style={s.spacer} /><Button title="Открыть демораунд ↗" onPress={startDemo} /><Button title="Назад" onPress={() => setScreen('lobby')} secondary />
    </>}
    {busy && <ActivityIndicator color={C.lime} style={{ marginTop: 10 }} />}
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
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
