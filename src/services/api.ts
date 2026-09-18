export const API_URL = process.env.EXPO_PUBLIC_GAME_API_URL ?? '';
const PUBLIC_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
let session = '';
export function setSession(value: string) { session = value; }
export async function request<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!API_URL) throw new Error('Сервер ещё не подключён. Пока доступен демораунд.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(PUBLIC_KEY ? { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}` } : {}), ...(session ? { 'X-Hundo-Session': session } : {}) }, body: JSON.stringify({ action, ...data }), signal: controller.signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Не удалось связаться с сервером');
    return body as T;
  } finally { clearTimeout(timeout); }
}
