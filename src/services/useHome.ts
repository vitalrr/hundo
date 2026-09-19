import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { API_URL, request } from './api';

export type HomeRound = {
  id: string; startsAt: string; phase: 'lobby' | 'live';
  playerCount: number; isRehearsal: boolean;
};
type HomeResponse = { serverTime: string; round: HomeRound | null };

export function useHome(enabled: boolean) {
  const [data, setData] = useState<HomeResponse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, inFlight = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      if (stopped || inFlight) return;
      clearTimeout(timer);
      if (AppState.currentState === 'background') return;
      inFlight = true;
      try {
        if (!API_URL) throw new Error('The game server is not connected yet.');
        const next = await request<HomeResponse>('home');
        if (!stopped) { setData(next); setError(''); }
      } catch {
        // Never turn a connection failure into a fake zero or a scheduled game.
        if (!stopped) { setData(null); setError('Live updates unavailable. Reconnecting…'); }
      } finally {
        inFlight = false;
        if (!stopped) timer = setTimeout(refresh, 5000);
      }
    }
    void refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { stopped = true; clearTimeout(timer); listener.remove(); };
  }, [enabled]);
  return { data, error };
}
