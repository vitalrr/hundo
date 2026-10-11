import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownOffsetSeconds, phaseCueIsOnTime } from '../src/game/audioTiming.ts';

test('countdown music seeks to the same fractional second as the visible clock', () => {
  assert.equal(countdownOffsetSeconds(15_000), 0);
  assert.equal(countdownOffsetSeconds(12_400), 2.6);
  assert.equal(countdownOffsetSeconds(0), 15);
});

test('late audio loading cannot play an opening cue halfway through the phase', () => {
  assert.equal(phaseCueIsOnTime('question', 14_900), true);
  assert.equal(phaseCueIsOnTime('question', 12_000), false);
  assert.equal(phaseCueIsOnTime('result', 4_900), true);
  assert.equal(phaseCueIsOnTime('result', 2_000), false);
});
