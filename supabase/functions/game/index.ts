import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import nacl from 'npm:tweetnacl@1.0.3';
import { Buffer } from 'node:buffer';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const rpc = new Connection(Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com', 'finalized');
const encoder = new TextEncoder();
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-hundo-session,apikey,authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const hash = async (s: string) => Buffer.from(await crypto.subtle.digest('SHA-256', encoder.encode(s))).toString('hex');
function check(error: unknown) { if (error) throw new Error('Не удалось обработать запрос'); }
function uuid(value: unknown): string { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Некорректный ID'); return value; }
function verifySignedMessage(payload: Uint8Array, message: Uint8Array, key: Uint8Array) {
  // Some wallets return a detached Ed25519 signature. Always verify the stored challenge.
  if (payload.length === 64) return nacl.sign.detached.verify(message, payload, key);
  // MWA returns a signed payload. Support signature-prefix and signature-suffix encodings.
  if (payload.length !== message.length + 64) return false;
  const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
  return equal(payload.subarray(64), message) && nacl.sign.detached.verify(message, payload.subarray(0, 64), key)
    || equal(payload.subarray(0, -64), message) && nacl.sign.detached.verify(message, payload.subarray(-64), key);
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const raw = await req.text(); if (raw.length > 8192) return json({ error: 'Request too large' }, 413);
    const body = JSON.parse(raw);
    if (body.action === 'home') {
      const { data, error } = await db.rpc('hundo_home'); check(error);
      return json(data);
    }
    if (body.action === 'results') {
      const requestedId = body.roundId == null ? null : uuid(body.roundId);
      let query = db.from('hundo_rounds').select('id,starts_at,is_rehearsal')
        .eq('is_rehearsal', false).lte('starts_at', new Date(Date.now() - 200000).toISOString());
      query = requestedId ? query.eq('id', requestedId) : query.order('starts_at', { ascending: false }).limit(1);
      const { data: round, error } = await query.maybeSingle(); check(error);
      if (!round) return json({ round: null, questions: [] });
      const settled = await db.rpc('hundo_settle', { p_round: round.id }); check(settled.error);
      const { data: questions, error: questionsError } = await db.from('hundo_questions')
        .select('number,text,options,counts').eq('round_id', round.id).order('number'); check(questionsError);
      if (questions?.length !== 10 || questions.some(q => !Array.isArray(q.counts))) return json({ round: null, questions: [] });
      const { count, error: playersError } = await db.from('hundo_players').select('wallet', { count: 'exact', head: true }).eq('round_id', round.id); check(playersError);
      return json({ round: { id: round.id, startsAt: round.starts_at, playerCount: count ?? 0 }, questions });
    }
    if (body.action === 'challenge') {
      const wallet = new PublicKey(body.wallet).toBase58();
      const { count, error: countError } = await db.from('hundo_challenges').select('id', { count: 'exact', head: true }).eq('wallet', wallet).gt('expires_at', new Date().toISOString()); check(countError);
      if ((count ?? 0) >= 3) return json({ error: 'Подожди несколько минут перед повторным входом' }, 429);
      const id = crypto.randomUUID();
      const message = `hundo wallet sign-in\nServer: ${new URL(Deno.env.get('SUPABASE_URL')!).host}\nWallet: ${wallet}\nNonce: ${id}\nIssued: ${new Date().toISOString()}\nThis signature signs you in. It does not transfer funds.`;
      const { error } = await db.from('hundo_challenges').insert({ id, wallet, message }); check(error);
      return json({ id, message });
    }
    if (body.action === 'authenticate') {
      const id = uuid(body.id);
      const { data: challenge, error } = await db.from('hundo_challenges').select('*').eq('id', id).gt('expires_at', new Date().toISOString()).maybeSingle(); check(error);
      if (!challenge) return json({ error: 'Запрос входа истёк или уже использован. Подключись заново.' }, 401);
      if (typeof body.signedMessage !== 'string') return json({ error: 'Кошелёк не вернул подпись' }, 401);
      const payload = Buffer.from(body.signedMessage, 'base64');
      const message = encoder.encode(challenge.message);
      if (!verifySignedMessage(payload, message, new PublicKey(challenge.wallet).toBytes())) return json({ error: `Подпись не прошла проверку (формат ${payload.length}/${message.length}).` }, 401);
      // DELETE RETURNING makes each challenge consumable exactly once, even under concurrent requests.
      const { data: consumed, error: consumeError } = await db.from('hundo_challenges').delete().eq('id', id).gt('expires_at', new Date().toISOString()).select('id'); check(consumeError);
      if (consumed?.length !== 1) return json({ error: 'Запрос входа уже использован' }, 401);
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
      const { error: sessionError } = await db.from('hundo_sessions').insert({ token_hash: await hash(token), wallet: challenge.wallet }); check(sessionError);
      return json({ token });
    }
    const token = req.headers.get('X-Hundo-Session') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Подключи кошелёк заново' }, 401);
    const sessionHash = await hash(token);
    const { data: session, error: sessionError } = await db.from('hundo_sessions').select('wallet,expires_at').eq('token_hash', sessionHash).gt('expires_at', new Date().toISOString()).maybeSingle(); check(sessionError);
    if (!session) return json({ error: 'Сессия истекла. Подключи кошелёк заново' }, 401);
    const wallet = session.wallet;
    if (body.action === 'session') {
      if (new Date(session.expires_at).getTime() < Date.now() + 7 * 86400000) {
        const { error } = await db.from('hundo_sessions').update({ expires_at: new Date(Date.now() + 30 * 86400000).toISOString() }).eq('token_hash', sessionHash); check(error);
      }
      return json({ wallet });
    }
    if (body.action === 'push-register') {
      const installation = uuid(body.installationId);
      if (typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 4096 || /\s/.test(body.token)) return json({ error: 'Invalid notification token' }, 400);
      const { error } = await db.rpc('hundo_register_push', { p_wallet: wallet, p_installation: installation, p_token: body.token });
      if (error) return json({ error: 'Could not enable reminders. Reconnect the original wallet or check your device limit.' }, 409);
      return json({ enabled: true });
    }
    if (body.action === 'push-disable') {
      const installation = uuid(body.installationId);
      const { error } = await db.from('hundo_push_devices').update({ enabled: false, updated_at: new Date().toISOString() }).eq('installation_id', installation).eq('wallet', wallet); check(error);
      return json({ enabled: false });
    }
    if (body.action === 'push-status') {
      const installation = uuid(body.installationId);
      const { data, error } = await db.from('hundo_push_devices').select('enabled').eq('installation_id', installation).eq('wallet', wallet).maybeSingle(); check(error);
      return json({ enabled: data?.enabled ?? false });
    }
    if (body.action === 'latest') {
      const { data, error } = await db.rpc('hundo_home'); check(error);
      return json({ roundId: data?.round?.id ?? null });
    }
    if (body.action === 'archive') {
      const { data: round, error } = await db.from('hundo_rounds').select('id,starts_at').lt('starts_at', new Date(Date.now() - 200000).toISOString()).order('starts_at', { ascending: false }).limit(1).maybeSingle(); check(error);
      if (!round) return json({ round: null });
      const settled = await db.rpc('hundo_settle', { p_round: round.id }); check(settled.error);
      const { data: questions, error: questionError } = await db.from('hundo_questions').select('number,text,options,counts,leaders').eq('round_id', round.id).order('number'); check(questionError);
      return json({ round, questions });
    }
    const roundId = uuid(body.roundId);
    if (body.action === 'join-rehearsal') {
      const { error } = await db.rpc('hundo_join_rehearsal', { p_round: roundId, p_wallet: wallet }); check(error);
      return json({ joined: true });
    }
    if (body.action === 'join') {
      if (typeof body.signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(body.signature)) throw new Error('Некорректная транзакция');
      const tx = await rpc.getParsedTransaction(body.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
      if (!tx || !tx.meta || tx.meta.err) throw new Error('Транзакция пока не финализирована');
      const signer = tx.transaction.message.accountKeys.find(k => k.pubkey.toBase58() === wallet && k.signer);
      const memo = tx.transaction.message.instructions.some(i => 'parsed' in i && i.programId.toBase58() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' && i.parsed === `hundo:v1:join:${roundId}`);
      if (!signer || !memo) throw new Error('Транзакция не подтверждает участие в этом раунде');
      const { error } = await db.rpc('hundo_join', { p_round: roundId, p_wallet: wallet, p_signature: body.signature }); check(error);
      return json({ joined: true });
    }
    if (body.action === 'answer') {
      if (!Number.isInteger(body.index) || !Number.isInteger(body.choice)) throw new Error('Некорректный ответ');
      const { error } = await db.rpc('hundo_answer', { p_round: roundId, p_wallet: wallet, p_number: body.index, p_choice: body.choice });
      if (error) return json({ error: 'Ответ не принят: время вышло, ответ уже зафиксирован или ты выбыл.' }, 409);
      return json({ accepted: true });
    }
    if (body.action === 'snapshot') {
      const { data, error } = await db.rpc('hundo_snapshot', { p_round: roundId, p_wallet: wallet }); check(error);
      const { data: round, error: roundError } = await db.from('hundo_rounds').select('is_rehearsal').eq('id', roundId).single(); check(roundError);
      return json({ ...data, isRehearsal: round.is_rehearsal });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Ошибка запроса' }, 400); }
});
