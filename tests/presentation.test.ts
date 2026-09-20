import test from 'node:test';
import assert from 'node:assert/strict';
import { answerTone, resultOutcome, shouldTakeOver } from '../src/game/presentation.ts';

test('live game takes over at 15 seconds and stays full-screen through final',()=>{
 assert.equal(shouldTakeOver('lobby',16),false);
 assert.equal(shouldTakeOver('lobby',15),true);
 assert.equal(shouldTakeOver('lobby',0),true);
 for(const phase of ['question','result','final'] as const) assert.equal(shouldTakeOver(phase,10),true);
});
test('selection stays distinct from revealed majority and wrong answers',()=>{
 assert.equal(answerTone(1,1,false,[0]),'selected');
 assert.equal(answerTone(1,0,false,[0]),'neutral');
 assert.equal(answerTone(1,1,true,[0]),'wrong');
 assert.equal(answerTone(1,0,true,[0]),'majority');
 assert.equal(answerTone(1,1,true,[0,1]),'majority');
 assert.equal(answerTone(null,1,true,[0]),'neutral');
});
test('elimination feedback is shown once before switching to spectator mode',()=>{
 assert.equal(resultOutcome(true,null,0),'correct');
 assert.equal(resultOutcome(true,0,0),'out');
 assert.equal(resultOutcome(true,0,1),'spectator');
 assert.equal(resultOutcome(false,null,0),'spectator');
});
