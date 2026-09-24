import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { request } from '../services/api';
import type { CrowdQuestion } from '../game/crowd';

type Results = {
  round: { id: string; startsAt: string; playerCount: number; isRehearsal: boolean } | null;
  questions: CrowdQuestion[];
};

export function RoundResults({ roundId, onBack }: { roundId: string | null; onBack: () => void }) {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError(''); setIndex(0);
    void request<Results>('results', roundId ? { roundId } : {}).then(result => {
      if (active) setData(result);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load the results.'); });
    return () => { active = false; };
  }, [roundId]);
  const question = data?.questions[index];
  const total = question?.counts.reduce((sum, count) => sum + count, 0) ?? 0;
  const max = question ? Math.max(...question.counts) : 0;
  return <ScrollView contentContainerStyle={s.page}>
    <Text style={s.logo}>hundo<Text style={s.dot}>.</Text></Text>
    <Text style={s.label}>THE ROOM HAS SPOKEN</Text>
    <Text style={s.title}>The latest crowd</Text>
    {error ? <Text style={s.message}>{error}</Text> : !data ? <ActivityIndicator color="#7047EB" /> : !data.round ?
      <Text style={s.message}>No completed game to show yet. Come back after the round.</Text> : <>
        <Text style={s.message}>{new Date(data.round.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {data.round.playerCount} people in the room{data.round.isRehearsal ? ' · recorded rehearsal' : ''}</Text>
        {question && <View style={s.card}>
          <Text style={s.questionNumber}>QUESTION {index + 1} / {data.questions.length}</Text>
          <Text style={s.question}>{question.text}</Text>
          <Text style={s.hint}>What did most players say?</Text>
          {question.options.map((option, optionIndex) => {
            const percent = total ? Math.round(question.counts[optionIndex] / total * 100) : 0;
            const leader = total > 0 && question.counts[optionIndex] === max;
            return <View key={optionIndex} style={[s.option, leader && s.leader]}>
              <View style={s.optionTop}><Text style={s.optionText}>{'ABCD'[optionIndex]} · {option}</Text><Text style={s.percent}>{percent}%</Text></View>
              <View style={s.track}><View style={[s.fill, { width: `${percent}%`, backgroundColor: leader ? '#7047EB' : '#A7AA9B' }]} /></View>
            </View>;
          })}
        </View>}
        <View style={s.navigation}><Pressable accessibilityRole="button" disabled={index === 0} onPress={() => setIndex(value => value - 1)} style={[s.navButton, index === 0 && s.disabled]}><Text style={s.navText}>← Previous</Text></Pressable><Pressable accessibilityRole="button" disabled={index >= data.questions.length - 1} onPress={() => setIndex(value => value + 1)} style={[s.navButton, index >= data.questions.length - 1 && s.disabled]}><Text style={s.navText}>Next →</Text></Pressable></View>
        {data.round.isRehearsal && <Text style={s.message}>Rehearsal results · no prizes were paid.</Text>}
      </>}
    <Pressable accessibilityRole="button" onPress={onBack} style={s.back}><Text style={s.backText}>Back to home</Text></Pressable>
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, gap: 16, maxWidth: 600, width: '100%', alignSelf: 'center', backgroundColor: '#E8FF79' },
  logo: { color: '#202020', fontSize: 38, fontWeight: '900', letterSpacing: -2 }, dot: { color: '#7047EB' },
  label: { color: '#7047EB', fontSize: 11, letterSpacing: 1.5, fontWeight: '800', marginTop: 28 },
  title: { color: '#202020', fontSize: 42, fontWeight: '900', letterSpacing: -1.5 },
  message: { color: '#4C5438', fontSize: 15, lineHeight: 23 },
  card: { backgroundColor: '#F7FFD9', borderRadius: 24, padding: 20, gap: 14 },
  questionNumber: { color: '#7047EB', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  question: { color: '#202020', fontSize: 27, lineHeight: 34, fontWeight: '800' },
  hint: { color: '#4C5438', fontSize: 13 },
  option: { borderColor: '#C4D49A', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  leader: { borderColor: '#7047EB', borderWidth: 2, backgroundColor: '#EEE8FF' },
  optionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  optionText: { color: '#202020', fontSize: 15, fontWeight: '600', flex: 1 }, percent: { color: '#7047EB', fontSize: 16, fontWeight: '900' },
  track: { backgroundColor: '#DEE4CE', height: 6, borderRadius: 3, overflow: 'hidden' }, fill: { height: 6, borderRadius: 3 },
  navigation: { flexDirection: 'row', gap: 10 }, navButton: { flex: 1, backgroundColor: '#7047EB', borderRadius: 14, padding: 14 }, disabled: { opacity: 0.35 }, navText: { color: 'white', textAlign: 'center', fontWeight: '800' },
  back: { marginTop: 'auto', padding: 18, backgroundColor: '#7047EB', borderRadius: 16 }, backText: { color: 'white', fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
