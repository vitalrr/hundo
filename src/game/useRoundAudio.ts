import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Asset } from 'expo-asset';
import { audioFileUri } from './audioSource';
import type { StagePhase } from './presentation';

export function useRoundAudio(phase: StagePhase, index: number, seconds: number, outcome: string, enabled: boolean) {
  const [sources, setSources] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let mounted = true;
    void Asset.loadAsync([
      require('../../assets/audio/pulse.wav'), require('../../assets/audio/tick.wav'),
      require('../../assets/audio/start.wav'), require('../../assets/audio/correct.wav'),
      require('../../assets/audio/out.wav'), require('../../assets/audio/countdown.wav'),
    ]).then(assets => {
      if (mounted) setSources(assets.map(asset => audioFileUri(asset.localUri ?? asset.uri, Platform.OS)));
    }).catch(() => { if (mounted) setLoadError(true); });
    return () => { mounted = false; };
  }, []);
  const pulse = useAudioPlayer(sources[0] ? {uri: sources[0]} : null);
  const tick = useAudioPlayer(sources[1] ? {uri: sources[1]} : null);
  const start = useAudioPlayer(sources[2] ? {uri: sources[2]} : null);
  const correct = useAudioPlayer(sources[3] ? {uri: sources[3]} : null);
  const out = useAudioPlayer(sources[4] ? {uri: sources[4]} : null);
  const countdown = useAudioPlayer(sources[5] ? {uri: sources[5]} : null);
  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;
  const tickStatus = useAudioPlayerStatus(tick);
  const startStatus = useAudioPlayerStatus(start);
  const correctStatus = useAudioPlayerStatus(correct);
  const outStatus = useAudioPlayerStatus(out);
  const [ready, setReady] = useState(false);
  const pulseStatus = useAudioPlayerStatus(pulse);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const lastCue = useRef('');
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false }).then(() => setReady(true)).catch(() => setReady(true));
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  const audible = enabled && foreground && ready;
  useEffect(() => {
    // Do not pause on transient isLoaded events: Android emits false when
    // buffering ends, even though the prepared player can keep playing.
    try {
      pulse.loop = true; pulse.volume = .3;
      if (audible && phase === 'question' && sources.length) pulse.play();
      else pulse.pause();
      if (!audible) { tick.pause(); start.pause(); correct.pause(); out.pause(); }
    } catch { /* Audio must never block gameplay. */ }
  }, [audible, phase, sources.length, pulse, tick, start, correct, out]);
  useEffect(() => {
    let cancelled = false;
    try {
      if (audible && phase === 'lobby' && sources.length) {
        countdown.volume = .7;
        void countdown.seekTo(Math.max(0, 15 - secondsRef.current)).then(() => {
          if (!cancelled) countdown.play();
        }).catch(() => {});
      } else countdown.pause();
    } catch { /* A failed audio operation must not close the round. */ }
    // useAudioPlayer releases the previous native player during render when
    // the downloaded source replaces null. Effect cleanup runs afterwards:
    // calling pause here would access that already released shared object.
    // The hook owns disposal; the effect above handles mute and phase changes.
    return () => { cancelled = true; };
  }, [audible, phase, sources.length, countdown]);
  useEffect(() => {
    const countdownTick = (phase === 'question' && seconds <= 9) && seconds > 0;
    const key = countdownTick ? `${phase}:${index}:${seconds}` : `${phase}:${index}:${outcome}`;
    if (key === lastCue.current) return;
    if (!audible) return;
    const player = countdownTick ? tick : phase === 'question' ? start : phase === 'result' && outcome === 'correct' ? correct : phase === 'result' && outcome === 'out' ? out : null;
    const loaded = player === tick ? tickStatus.isLoaded : player === start ? startStatus.isLoaded : player === correct ? correctStatus.isLoaded : outStatus.isLoaded;
    if (!player || !loaded) return;
    lastCue.current = key;
    let cancelled = false;
    if (phase === 'lobby' && seconds === 15 || phase === 'question' && seconds >= 9) Vibration.vibrate(60);
    try { void player.seekTo(0).then(() => { if (!cancelled) { player.volume = .7; player.play(); } }).catch(() => {}); } catch { /* Unavailable player. */ }
    return () => { cancelled = true; };
  }, [audible, phase, index, seconds, outcome, tick, start, correct, out, tickStatus.isLoaded, startStatus.isLoaded, correctStatus.isLoaded, outStatus.isLoaded]);
  return loadError ? 'unavailable' : sources.length && pulseStatus.isLoaded ? 'ready' : 'loading';
}
