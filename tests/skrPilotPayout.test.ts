import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
const { Keypair, PublicKey, Transaction, TransactionInstruction } = require('@solana/web3.js');
const { ata, createAtaInstruction, transferCheckedInstruction, readTokenAmount, verifiedSoleFinalist, validatedSignedBytes } = require('../scripts/skr-pilot-payout.cjs');

const treasury = new PublicKey('FRSmMsMYtb69CcCniKP97ANS1u5ukkTYoYgATm4w4L2y');
const winner = new PublicKey('GhSaDCrTNbXwLWPXzzEVqWYVwMfNocUMqNG3BTkzDU9Z');
const mint = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');
const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const roundId = '11111111-1111-4111-8111-111111111111';

test('pilot transfer is exactly one official SKR and derives standard token accounts', () => {
  const source = ata(treasury), destination = ata(winner);
  assert.equal(source.toBase58(), '6Rvjm5Cic59eeUc26YURvHaPq9BLEQdk9zj6QKqH9RNa');
  const create = createAtaInstruction(treasury, winner, destination);
  assert.equal(create.data.toString('hex'), '01');
  assert.equal(create.keys[1].pubkey.toBase58(), destination.toBase58());
  const transfer = transferCheckedInstruction(source, destination, treasury);
  assert.equal(transfer.programId.toBase58(), tokenProgram.toBase58());
  assert.equal(transfer.keys[1].pubkey.toBase58(), mint.toBase58());
  assert.equal(transfer.data[0], 12);
  assert.equal(transfer.data.readBigUInt64LE(1), 1_000_000n);
  assert.equal(transfer.data[9], 6);
});

test('pilot rejects token accounts with another mint or owner', () => {
  const data = Buffer.alloc(165);
  mint.toBuffer().copy(data, 0);
  treasury.toBuffer().copy(data, 32);
  data.writeBigUInt64LE(1_000_000n, 64);
  assert.equal(readTokenAmount({ owner: tokenProgram, data }, treasury), 1_000_000n);
  assert.throws(() => readTokenAmount({ owner: tokenProgram, data }, winner), /wrong wallet owner/);
  data[0] ^= 1;
  assert.throws(() => readTokenAmount({ owner: tokenProgram, data }, treasury), /wrong mint/);
});

test('pilot refuses a signed receipt containing any extra payment instruction', () => {
  const payer = Keypair.generate();
  const blockhash = PublicKey.default.toBase58();
  const build = (extra: boolean) => {
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
    tx.add(transferCheckedInstruction(ata(payer.publicKey), ata(winner), payer.publicKey));
    tx.add(new TransactionInstruction({ programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), keys: [], data: Buffer.from(`hundo:1-skr-pilot:${roundId}`) }));
    if (extra) tx.add(new TransactionInstruction({ programId: PublicKey.default, keys: [], data: Buffer.alloc(0) }));
    tx.sign(payer);
    return { roundId, recipient: winner.toBase58(), treasury: payer.publicKey.toBase58(), source: ata(payer.publicKey).toBase58(), destination: ata(winner).toBase58(), blockhash: { blockhash }, signature: require('bs58').encode(tx.signature), signedTransaction: tx.serialize().toString('base64') };
  };
  assert.ok(validatedSignedBytes(build(false), payer).length > 0);
  assert.throws(() => validatedSignedBytes(build(true), payer), /Unexpected instructions/);
});

test('pilot only prepares payment to the sole settled finalist', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.HUNDO_SUPABASE_URL;
  const originalKey = process.env.HUNDO_SUPABASE_SERVICE_ROLE_KEY;
  process.env.HUNDO_SUPABASE_URL = 'https://example.supabase.co';
  process.env.HUNDO_SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  let finalists = [{ wallet: winner.toBase58(), eliminated_at: null }];
  globalThis.fetch = async (url: string) => {
    if (url.includes('/rpc/hundo_settle')) return new Response(null, { status: 204 });
    if (url.includes('/hundo_rounds?')) return Response.json([{ id: roundId, starts_at: '2026-01-01T00:00:00Z', is_rehearsal: true, pot_lamports: 0, settled_through: 9 }]);
    if (url.includes('/hundo_players?')) return Response.json(finalists);
    throw new Error('Unexpected request');
  };
  try {
    await verifiedSoleFinalist(roundId, winner);
    finalists = [{ wallet: winner.toBase58(), eliminated_at: null }, { wallet: treasury.toBase58(), eliminated_at: null }];
    await assert.rejects(verifiedSoleFinalist(roundId, winner), /sole finalist/);
    finalists = [{ wallet: treasury.toBase58(), eliminated_at: null }];
    await assert.rejects(verifiedSoleFinalist(roundId, winner), /sole finalist/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.HUNDO_SUPABASE_URL;
    else process.env.HUNDO_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.HUNDO_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.HUNDO_SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test('pilot database permits only one private, exact 1 SKR prize record', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const file of ['202609180001_hundo.sql', '202609190001_home.sql', '202610090001_skr_pilot.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.query("insert into hundo_rounds(id,starts_at,pot_wallet,pot_lamports,is_rehearsal) values($1,clock_timestamp()+interval '1 hour','test',0,true)", [roundId]);
    await db.query('insert into hundo_skr_pilots(round_id,treasury_wallet) values($1,$2)', [roundId, treasury.toBase58()]);
    const otherRound = '22222222-2222-4222-8222-222222222222';
    await db.query("insert into hundo_rounds(id,starts_at,pot_wallet,pot_lamports,is_rehearsal) values($1,clock_timestamp()+interval '2 hours','test',0,true)", [otherRound]);
    await assert.rejects(db.query('insert into hundo_skr_pilots(round_id,treasury_wallet) values($1,$2)', [otherRound, treasury.toBase58()]), /unique/);
    await assert.rejects(db.query("update hundo_skr_pilots set amount_raw=2000000 where round_id=$1", [roundId]), /check/);
    await assert.rejects(db.query("update hundo_skr_pilots set status='confirmed' where round_id=$1", [roundId]), /check/);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from hundo_skr_pilots'), /permission/);
  } finally { await db.close(); }
});
