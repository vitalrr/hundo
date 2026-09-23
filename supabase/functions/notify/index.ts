import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const db = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const projectId = Deno.env.get('FCM_PROJECT_ID') || 'hundo-3d60e';
const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET') || '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-hundo-notify-secret,authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function utf8Base64Url(value: string): string {
  return base64Url(new TextEncoder().encode(value));
}

function pemBytes(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function accessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = utf8Base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = utf8Base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(serviceAccount.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  const assertion = `${header}.${claim}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await response.json();
  if (!response.ok || typeof body.access_token !== 'string') throw new Error('Could not obtain FCM access token');
  return body.access_token;
}

async function sendFcm(token: string, roundId: string, startsAt: string, bearer: string, kind: 'game-reminder' | 'game-results'): Promise<{ ok: boolean; error?: string; unregister?: boolean }> {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: {
      token,
      notification: kind === 'game-reminder'
        ? { title: 'Hundo starts soon', body: 'The room opens in 5 minutes. Read the crowd.' }
        : { title: 'The room has spoken', body: 'See what the crowd picked today.' },
      data: { kind, roundId, startsAt },
      android: { priority: 'HIGH', notification: { channel_id: 'hundo-games', sound: 'default' } },
    } }),
  });
  if (response.ok) return { ok: true };
  const text = await response.text();
  return { ok: false, error: text.slice(0, 500), unregister: /UNREGISTERED|registration-token-not-registered/i.test(text) };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!cronSecret || req.headers.get('X-Hundo-Notify-Secret') !== cronSecret) return json({ error: 'Unauthorized' }, 401);
  try {
    const accountText = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    if (!accountText) return json({ error: 'FCM sender is not configured' }, 503);
    const account = JSON.parse(accountText);
    if (typeof account.client_email !== 'string' || typeof account.private_key !== 'string') return json({ error: 'FCM sender key is invalid' }, 503);

    const now = Date.now();
    const from = new Date(now + 4 * 60_000).toISOString();
    const to = new Date(now + 6 * 60_000).toISOString();
    const { data: rounds, error: roundError } = await db.from('hundo_rounds')
      .select('id,starts_at,is_rehearsal').gt('starts_at', from).lte('starts_at', to).order('starts_at').limit(3);
    if (roundError) throw roundError;
    const { data: completed, error: completedError } = await db.from('hundo_rounds')
      .select('id,starts_at').eq('is_rehearsal', false)
      .lte('starts_at', new Date(now - 200000).toISOString())
      .gt('starts_at', new Date(now - 800000).toISOString())
      .order('starts_at', { ascending: false }).limit(3);
    if (completedError) throw completedError;
    if (!rounds?.length && !completed?.length) return json({ sent: 0, rounds: 0 });

    const { data: devices, error: deviceError } = await db.from('hundo_push_devices').select('installation_id,token').eq('enabled', true).limit(5000);
    if (deviceError) throw deviceError;
    let sent = 0;
    let failed = 0;
    const token = await accessToken(account);
    for (const round of rounds ?? []) {
      const { count, error: questionError } = await db.from('hundo_questions').select('number', { count: 'exact', head: true }).eq('round_id', round.id);
      if (questionError) throw questionError;
      if (count !== 10) continue;
      for (const device of devices ?? []) {
        const { data: inserted, error: insertError } = await db.from('hundo_push_deliveries').insert({ round_id: round.id, installation_id: device.installation_id, token: device.token }).select('round_id,installation_id').maybeSingle();
        if (insertError && insertError.code !== '23505') throw insertError;
        if (!inserted) continue; // Another retry already claimed this reminder.
        const result = await sendFcm(device.token, round.id, round.starts_at, token, 'game-reminder');
        await db.from('hundo_push_deliveries').update({ status: result.ok ? 'sent' : 'failed', attempts: 1, sent_at: result.ok ? new Date().toISOString() : null, last_error: result.error ?? null, updated_at: new Date().toISOString() }).eq('round_id', round.id).eq('installation_id', device.installation_id);
        if (result.unregister) await db.from('hundo_push_devices').update({ enabled: false, updated_at: new Date().toISOString() }).eq('installation_id', device.installation_id);
        if (result.ok) sent++; else failed++;
      }
    }
    for (const round of completed ?? []) {
      const settled = await db.rpc('hundo_settle', { p_round: round.id });
      if (settled.error) throw settled.error;
      const { data: questions, error: questionError } = await db.from('hundo_questions').select('counts').eq('round_id', round.id);
      if (questionError) throw questionError;
      if (questions?.length !== 10 || questions.some(q => !Array.isArray(q.counts))) continue;
      const { count: playerCount, error: playerError } = await db.from('hundo_players').select('wallet', { count: 'exact', head: true }).eq('round_id', round.id);
      if (playerError) throw playerError;
      if (!playerCount) continue;
      for (const device of devices ?? []) {
        const { data: inserted, error: insertError } = await db.from('hundo_result_push_deliveries')
          .insert({ round_id: round.id, installation_id: device.installation_id })
          .select('round_id,installation_id').maybeSingle();
        if (insertError && insertError.code !== '23505') throw insertError;
        if (!inserted) continue;
        const result = await sendFcm(device.token, round.id, round.starts_at, token, 'game-results');
        await db.from('hundo_result_push_deliveries').update({ status: result.ok ? 'sent' : 'failed', sent_at: result.ok ? new Date().toISOString() : null, last_error: result.error ?? null, updated_at: new Date().toISOString() }).eq('round_id', round.id).eq('installation_id', device.installation_id);
        if (result.unregister) await db.from('hundo_push_devices').update({ enabled: false, updated_at: new Date().toISOString() }).eq('installation_id', device.installation_id);
        if (result.ok) sent++; else failed++;
      }
    }
    return json({ sent, failed, rounds: (rounds?.length ?? 0) + (completed?.length ?? 0) });
  } catch (error) {
    console.error(error);
    return json({ error: 'Notification delivery failed' }, 500);
  }
});
