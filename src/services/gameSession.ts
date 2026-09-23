import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'hundo-game-session-v1';

export type GameSession = { wallet: string; token: string };

export async function loadGameSession(): Promise<GameSession | null> {
  if (Platform.OS === 'web') return null;
  const value = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!value) return null;
  try {
    const session: unknown = JSON.parse(value);
    if (session && typeof session === 'object' && 'wallet' in session && 'token' in session &&
      typeof session.wallet === 'string' && typeof session.token === 'string' &&
      /^[a-f0-9]{64}$/.test(session.token)) return session as GameSession;
  } catch { /* An interrupted write should simply require signing in again. */ }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  return null;
}

export async function saveGameSession(session: GameSession): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
}

export async function clearGameSession(): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(STORAGE_KEY);
}
