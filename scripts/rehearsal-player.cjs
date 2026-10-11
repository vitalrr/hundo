// A single, explicitly simulated opponent for a user-supervised Seeker rehearsal.
// Only joins the supplied prize-free round. Never submits Solana transactions.
const { Keypair } = require('@solana/web3.js');
const crypto = require('node:crypto');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const roundId = process.argv[2];
const role = process.argv[3] || 'all-a';
if (!/^[0-9a-f-]{36}$/i.test(roundId || '')) {
 console.error('Usage: node scripts/rehearsal-player.cjs ROUND_UUID [all-a|support|dissent]');
 process.exit(1);
}
if (!['all-a', 'support', 'dissent'].includes(role)) {
 console.error('Role must be all-a, support, or dissent.');
 process.exit(1);
}
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const headers = {'Content-Type':'application/json',apikey:env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`};
let token;
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function call(action,data={}) {
 const response = await fetch(env.EXPO_PUBLIC_GAME_API_URL,{method:'POST',headers:{...headers,...(token?{'X-Hundo-Session':token}:{})},body:JSON.stringify({action,...data}),signal:AbortSignal.timeout(8000)});
 const body = await response.json();
 if (!response.ok) throw new Error(`${action}: ${response.status} ${body.error || 'Request failed'}`);
 return body;
}
async function main() {
 const home = await call('home');
 assert.equal(home.round?.id,roundId,'Supplied round must be the advertised round');
 assert.equal(home.round.isRehearsal,true,'Only rehearsals are allowed');
 assert.equal(home.round.potLamports,'0','No funded prize is allowed');
 assert.equal(home.round.phase,'lobby','Start this player before the game');
 assert.ok(Date.parse(home.round.startsAt)-Date.parse(home.serverTime)<30*60*1000,'Start must be within 30 minutes');
 const key = Keypair.generate();
 const wallet = key.publicKey.toBase58();
 const challenge = await call('challenge',{wallet});
 const privateKey = crypto.createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(key.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'});
 const signature = crypto.sign(null,Buffer.from(challenge.message),privateKey).toString('base64');
 token = (await call('authenticate',{id:challenge.id,signedMessage:signature})).token;
 await call('join-rehearsal',{roundId});
 await call('join-rehearsal',{roundId}); // An identical retry must preserve the same registration.
 console.log(`Simulated ${role} player joined ${roundId}. Wallet: ${wallet}`);
 console.log(role === 'all-a' ? 'Chooses A on all ten questions.' : role === 'support' ? 'Chooses A on questions 1–9, then abstains so a real player can be the sole finalist.' : 'Chooses B on question 1, then abstains to demonstrate elimination.');
 const stopAt = Date.now()+Math.max(0,Date.parse(home.round.startsAt)-Date.parse(home.serverTime))+210000;
 let lastPhase='', failures=0;
 const answered = new Set();
 while(Date.now()<stopAt) {
  try {
   const state = await call('snapshot',{roundId});
   assert.equal(state.isRehearsal,true);assert.equal(state.potLamports,'0');assert.equal(state.joined,true);
   const label=`${state.phase}:${state.index}`;
   if(label!==lastPhase) {
    console.log(JSON.stringify({phase:state.phase,question:state.index+1,players:state.playerCount,survivors:state.survivorCount,counts:state.counts,eliminatedAt:state.eliminatedAt}));
    lastPhase=label;
   }
   if(state.phase==='question') {
    assert.equal(state.counts,undefined,'Voting totals must stay hidden until reveal');
    const shouldAnswer = role === 'all-a' || role === 'support' && state.index < 9 || role === 'dissent' && state.index === 0;
    if(shouldAnswer && state.eliminatedAt===null && state.myChoice===null && !answered.has(state.index)) {
     await call('answer',{roundId,index:state.index,choice:role === 'dissent' ? 1 : 0});
     answered.add(state.index);
    }
   }
   if(state.phase==='final') {
    console.log(`Rehearsal complete: ${state.survivorCount}/${state.playerCount} finalists. No payments sent.`);
    return;
   }
   failures=0;
  } catch(error) {
   if(error instanceof assert.AssertionError) throw error;
   console.error(error.message);
   if(++failures>=5) throw new Error('Stopped after five consecutive connection failures.');
  }
  await delay(1000);
 }
 throw new Error('Timed out waiting for the final result.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
