import { useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { StagePhase } from './presentation';

export function useRoundAudio(phase: StagePhase, index: number, seconds: number, outcome: string, enabled: boolean) {
  const pulse = useAudioPlayer(require('../../assets/audio/pulse.wav'));
  const tick = useAudioPlayer(require('../../assets/audio/tick.wav'));
  const start = useAudioPlayer(require('../../assets/audio/start.wav'));
  const correct = useAudioPlayer(require('../../assets/audio/correct.wav'));
  const out = useAudioPlayer(require('../../assets/audio/out.wav'));
  const pulseStatus = useAudioPlayerStatus(pulse);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const lastCue = useRef('');
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false }).catch(() => {});
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  const audible = enabled && foreground;
  useEffect(() => {
    try {
      pulse.loop = true; pulse.volume = .18;
      if (audible && (phase === 'lobby' || phase === 'question') && pulseStatus.isLoaded) pulse.play();
      else pulse.pause();
      if (!audible) { tick.pause(); start.pause(); correct.pause(); out.pause(); }
    } catch { /* Audio must never block gameplay. */ }
  }, [audible, phase, pulseStatus.isLoaded, pulse, tick, start, correct, out]);
  useEffect(() => {
    const countdownTick = (phase === 'lobby' && seconds <= 15 || phase === 'question' && seconds <= 3) && seconds > 0;
    const key = countdownTick ? `${phase}:${index}:${seconds}` : `${phase}:${index}:${outcome}`;
    if (key === lastCue.current) return;
    lastCue.current = key;
    if (!audible) return;
    const player = countdownTick ? tick : phase === 'question' ? start : phase === 'result' && outcome === 'correct' ? correct : phase === 'result' && outcome === 'out' ? out : null;
    if (!player) return;
    let cancelled = false;
    if (phase === 'lobby' && seconds === 15 || phase === 'question' && seconds >= 9) Vibration.vibrate(60);
    try { void player.seekTo(0).then(() => { if (!cancelled) { player.volume = .5; player.play(); } }).catch(() => {}); } catch { /* Unavailable player. */ }
    return () => { cancelled = true; };
  }, [audible, phase, index, seconds, outcome, tick, start, correct, out]);
}
