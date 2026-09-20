// A single, explicitly simulated opponent for a user-supervised Seeker rehearsal.
// Only joins the supplied prize-free round. Never submits Solana transactions.
const { Keypair } = require('@solana/web3.js');
const crypto = require('node:crypto');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const roundId = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(roundId || '')) {
 console.error('Usage: node scripts/rehearsal-player.cjs ROUND_UUID');
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
 console.log(`Simulated player joined ${roundId}. Wallet: ${wallet}`);
 console.log('Chooses option A on every question. With two players, different choices tie and both advance.');
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
    if(state.eliminatedAt===null && state.myChoice===null && !answered.has(state.index)) {
     await call('answer',{roundId,index:state.index,choice:0});
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
