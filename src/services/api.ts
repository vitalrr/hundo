import { serverErrorMessage } from './errors';

export const API_URL = process.env.EXPO_PUBLIC_GAME_API_URL ?? '';
const PUBLIC_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
let session = '';
export function setSession(value: string) { session = value; }
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}
export async function request<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!API_URL) throw new Error('The server is not connected yet. Try the demo for now.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(PUBLIC_KEY ? { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}` } : {}), ...(session ? { 'X-Hundo-Session': session } : {}) }, body: JSON.stringify({ action, ...data }), signal: controller.signal });
    const body = await response.json();
    if (!response.ok) throw new ApiError(serverErrorMessage(body.error), response.status);
    return body as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The server took too long to respond. Please try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
