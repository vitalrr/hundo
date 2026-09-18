import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';
import nacl from 'npm:tweetnacl@1.0.3';
import { Buffer } from 'node:buffer';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const rpc = new Connection(Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com', 'finalized');
const encoder = new TextEncoder();
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-hundo-session', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const hash = async (s: string) => Buffer.from(await crypto.subtle.digest('SHA-256', encoder.encode(s))).toString('hex');
function check(error: unknown) { if (error) throw new Error('Не удалось обработать запрос'); }
function uuid(value: unknown): string { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Некорректный ID'); return value; }
function verifySignedMessage(payload: Uint8Array, message: Uint8Array, key: Uint8Array) {
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
      if (!challenge || typeof body.signedMessage !== 'string' || !verifySignedMessage(Buffer.from(body.signedMessage, 'base64'), encoder.encode(challenge.message), new PublicKey(challenge.wallet).toBytes())) return json({ error: 'Подпись не прошла проверку' }, 401);
      // DELETE RETURNING makes each challenge consumable exactly once, even under concurrent requests.
      const { data: consumed, error: consumeError } = await db.from('hundo_challenges').delete().eq('id', id).gt('expires_at', new Date().toISOString()).select('id'); check(consumeError);
      if (consumed?.length !== 1) return json({ error: 'Запрос входа уже использован' }, 401);
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
      const { error: sessionError } = await db.from('hundo_sessions').insert({ token_hash: await hash(token), wallet: challenge.wallet }); check(sessionError);
      return json({ token });
    }
    const token = req.headers.get('X-Hundo-Session') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Подключи кошелёк заново' }, 401);
    const { data: session, error: sessionError } = await db.from('hundo_sessions').select('wallet').eq('token_hash', await hash(token)).gt('expires_at', new Date().toISOString()).maybeSingle(); check(sessionError);
    if (!session) return json({ error: 'Сессия истекла. Подключи кошелёк заново' }, 401);
    const wallet = session.wallet;
    if (body.action === 'latest') {
      const { data, error } = await db.from('hundo_rounds').select('id').order('starts_at', { ascending: true }).gt('starts_at', new Date(Date.now() - 150000).toISOString()).limit(1).maybeSingle(); check(error);
      return json({ roundId: data?.id ?? null });
    }
    if (body.action === 'archive') {
      const { data: round, error } = await db.from('hundo_rounds').select('id,starts_at').lt('starts_at', new Date(Date.now() - 150000).toISOString()).order('starts_at', { ascending: false }).limit(1).maybeSingle(); check(error);
      if (!round) return json({ round: null });
      const settled = await db.rpc('hundo_settle', { p_round: round.id }); check(settled.error);
      const { data: questions, error: questionError } = await db.from('hundo_questions').select('number,text,options,counts,leaders').eq('round_id', round.id).order('number'); check(questionError);
      return json({ round, questions });
    }
    const roundId = uuid(body.roundId);
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
      return json(data);
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Ошибка запроса' }, 400); }
});
