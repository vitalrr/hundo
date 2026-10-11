#!/usr/bin/env node
// Supervised one-round cast: 56 clearly disclosed simulated participants.
// Never schedules a game, signs a Solana transaction, or triggers a payout.
'use strict';
const { Keypair } = require('@solana/web3.js');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { castChoice } = require('./video-cast-plan.cjs');

const roundId = process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roundId || '')) {
  console.error('Usage: node scripts/video-cast.cjs ROUND_UUID');
  process.exit(1);
}
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter(line => line.includes('=')).map(line => {
  const separator = line.indexOf('=');
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
const publicKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const apiUrl = env.EXPO_PUBLIC_GAME_API_URL;
if (!publicKey || !apiUrl) throw new Error('Public game API configuration is missing.');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function call(action, data = {}, token = '') {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publicKey, Authorization: `Bearer ${publicKey}`, ...(token ? { 'X-Hundo-Session': token } : {}) },
    body: JSON.stringify({ action, ...data }),
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${action}: ${response.status} ${body.error || 'Request failed'}`);
  return body;
}

async function register(player) {
  const key = Keypair.generate();
  const wallet = key.publicKey.toBase58();
  const challenge = await call('challenge', { wallet });
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(key.secretKey.subarray(0, 32))]),
    format: 'der', type: 'pkcs8',
  });
  const signedMessage = crypto.sign(null, Buffer.from(challenge.message), privateKey).toString('base64');
  const { token } = await call('authenticate', { id: challenge.id, signedMessage });
  await call('join-rehearsal', { roundId }, token);
  console.log(`Simulated player ${player + 1}/56 joined: ${wallet}`);
  return { player, token };
}

async function play({ player, token }, startLocal) {
  for (let question = 0; question < 10; question++) {
    const choice = castChoice(player, question);
    if (choice === null) return;
    const target = startLocal + question * 20_000 + 1500 + player * 120;
    await wait(Math.max(0, target - Date.now()));
    const state = await call('snapshot', { roundId }, token);
    if (!state.isRehearsal || state.potLamports !== '0' || !state.joined || state.survivorCap !== null) {
      throw new Error('Cast player must be in a prize-free rehearsal with no survivor cap.');
    }
    if (state.eliminatedAt !== null) return;
    if (state.phase !== 'question' || state.index !== question) throw new Error(`Missed question ${question + 1} for simulated player ${player + 1}.`);
    if (state.myChoice === null) await call('answer', { roundId, index: question, choice }, token);
    console.log(`Simulated player ${player + 1} answered ${'ABCD'[choice]} on question ${question + 1}`);
  }
}

async function main() {
  const home = await call('home');
  if (home.round?.id !== roundId || !home.round.isRehearsal || home.round.potLamports !== '0' || home.round.phase !== 'lobby') {
    throw new Error('The supplied round must be the advertised, zero-SOL rehearsal.');
  }
  const startLocal = Date.now() + Date.parse(home.round.startsAt) - Date.parse(home.serverTime);
  if (startLocal - Date.now() < 4 * 60_000 || startLocal - Date.now() > 30 * 60_000) {
    throw new Error('Start this 56-player cast 4 to 30 minutes before the scheduled round.');
  }
  if (home.round.playerCount > 1) throw new Error('Unexpected players are already in the room.');
  console.log('VIDEO REHEARSAL: 56 SIMULATED PLAYERS. Label them as simulated in the recording.');
  const cast = [];
  for (let player = 0; player < 56; player++) {
    cast.push(await register(player));
    await wait(120);
  }
  const ready = await call('home');
  if (ready.round?.id !== roundId || ready.round.playerCount > 57) throw new Error('Unexpected players joined; cancel this video round before it starts.');
  console.log(`${ready.round.playerCount}/57 joined. The Seeker must bring the total to exactly 57 before start.`);
  while (Date.now() < startLocal - 3000) {
    const current = await call('home');
    if (current.round?.id !== roundId || current.round.playerCount > 57) throw new Error('Room changed or unexpected players joined.');
    if (current.round.playerCount === 57) break;
    await wait(2000);
  }
  const finalCheck = await call('home');
  if (finalCheck.round?.id !== roundId || finalCheck.round.playerCount !== 57) {
    throw new Error('Exactly 57 joined players are required: one Seeker and 56 simulated participants.');
  }
  console.log('Cast ready: answer A on the Seeker for all 10 questions.');
  await Promise.all(cast.map(member => play(member, startLocal)));
  console.log('Simulated cast finished. The server determines the actual results.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
