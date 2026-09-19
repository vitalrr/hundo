// Uses an ephemeral, unfunded test wallet. Does not submit Solana transactions.
const { Keypair } = require('@solana/web3.js');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const key=Keypair.generate();
const headers={'Content-Type':'application/json',apikey:env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`};
async function call(body,token){const res=await fetch(env.EXPO_PUBLIC_GAME_API_URL,{method:'POST',headers:{...headers,...(token?{'X-Hundo-Session':token}:{})},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};}
(async()=>{
 assert.equal((await call({action:'latest'})).status,401);
 for (const format of ['prefix', 'suffix', 'detached']) {
 const challenge=await call({action:'challenge',wallet:key.publicKey.toBase58()});assert.equal(challenge.status,200);
 assert.equal((await call({action:'authenticate',id:challenge.body.id,signedMessage:Buffer.alloc(80).toString('base64')})).status,401);
 const message=Buffer.from(challenge.body.message,'utf8');
 const privateKey=crypto.createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(key.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'});
 const signature=crypto.sign(null,message,privateKey);
 const encode=(sig,msg)=> (format==='detached'?sig:Buffer.concat(format==='prefix'?[sig,msg]:[msg,sig])).toString('base64');
 const signed=encode(signature,message);
 const badSignature=Buffer.from(signature);badSignature[0]^=1;
 assert.equal((await call({action:'authenticate',id:challenge.body.id,signedMessage:encode(badSignature,message)})).status,401);
 assert.equal((await call({action:'authenticate',id:challenge.body.id,signedMessage:encode(crypto.sign(null,Buffer.from('wrong challenge'),privateKey),message)})).status,401);
 const auth=await call({action:'authenticate',id:challenge.body.id,signedMessage:signed});assert.equal(auth.status,200);assert.equal(auth.body.token.length,64);
 assert.equal((await call({action:'authenticate',id:challenge.body.id,signedMessage:signed})).status,401);
 const latest=await call({action:'latest'},auth.body.token);assert.equal(latest.status,200);
 const archive=await call({action:'archive'},auth.body.token);assert.equal(archive.status,200);
 console.log(`PASS: ${format}: valid login, tampered signature and wrong challenge rejection, replay rejection.`);
 }
 console.log('PASS: anonymous rejection, invalid signature rejection, signed login, nonce replay rejection, authenticated latest and archive. No funds or chain transactions used.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
