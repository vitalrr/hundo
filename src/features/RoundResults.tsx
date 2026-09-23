import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { request } from '../services/api';
import { CrowdRecap } from './CrowdRecap';
import type { CrowdQuestion } from '../game/crowd';

type Results = {
  round: { id: string; startsAt: string; playerCount: number } | null;
  questions: CrowdQuestion[];
};

export function RoundResults({ roundId, onBack }: { roundId: string | null; onBack: () => void }) {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    void request<Results>('results', roundId ? { roundId } : {}).then(result => {
      if (active) setData(result);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load the results.'); });
    return () => { active = false; };
  }, [roundId]);
  return <ScrollView contentContainerStyle={s.page}>
    <Text style={s.logo}>hundo<Text style={s.dot}>.</Text></Text>
    <Text style={s.label}>THE ROOM HAS SPOKEN</Text>
    <Text style={s.title}>The latest crowd</Text>
    {error ? <Text style={s.message}>{error}</Text> : !data ? <ActivityIndicator color="#7047EB" /> : !data.round ?
      <Text style={s.message}>No completed game to show yet. Come back after the round.</Text> :
      <View>
        <Text style={s.message}>{new Date(data.round.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {data.round.playerCount} people in the room</Text>
        <CrowdRecap questions={data.questions} title="The crowd believed:" />
      </View>}
    <Pressable accessibilityRole="button" onPress={onBack} style={s.back}><Text style={s.backText}>Back to home</Text></Pressable>
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, gap: 16, maxWidth: 600, width: '100%', alignSelf: 'center', backgroundColor: '#E8FF79' },
  logo: { color: '#202020', fontSize: 38, fontWeight: '900', letterSpacing: -2 },
  dot: { color: '#7047EB' },
  label: { color: '#7047EB', fontSize: 11, letterSpacing: 1.5, fontWeight: '800', marginTop: 28 },
  title: { color: '#202020', fontSize: 45, fontWeight: '900', letterSpacing: -1.5 },
  message: { color: '#4C5438', fontSize: 15, lineHeight: 23 },
  back: { marginTop: 'auto', padding: 18, backgroundColor: '#7047EB', borderRadius: 16 },
  backText: { color: 'white', fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
