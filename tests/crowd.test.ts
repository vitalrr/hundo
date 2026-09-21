import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdResult,personalCrowdResult} from '../src/game/crowd.ts';
test('crowd recap describes leading shares, ties and unanswered questions honestly',()=>{
 const q={number:0,text:'Question',options:['A','B','C','D'],counts:[30,47,13,10],myChoice:0};
 assert.equal(personalCrowdResult(q),'Most said “B” — 47%. You said “A”.');
 assert.match(crowdResult({...q,counts:[1,1,0,0]}).text,/tied.*50% each/);
 assert.equal(crowdResult({...q,counts:[0,0,0,0]}).text,'No votes in the room.');
 assert.match(personalCrowdResult({...q,myChoice:null}),/did not answer in time/);
});
