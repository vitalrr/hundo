import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, splitPot, questionPhase } from '../src/game/rules.ts';

test('tied options advance; a minority does not', () => {
  const result = settle([{ wallet: 'a', choice: 0, receivedAt: 1 }, { wallet: 'b', choice: 0, receivedAt: 2 }, { wallet: 'c', choice: 1, receivedAt: 1 }, { wallet: 'd', choice: 1, receivedAt: 2 }, { wallet: 'e', choice: 2, receivedAt: 3 }]);
  assert.deepEqual(result.leaders, [0, 1]); assert.equal(result.survivors.length, 4);
});
test('speed cap keeps equal-time players at boundary', () => {
  const result = settle([{ wallet: 'a', choice: 0, receivedAt: 1 }, { wallet: 'b', choice: 0, receivedAt: 2 }, { wallet: 'c', choice: 0, receivedAt: 2 }, { wallet: 'd', choice: 0, receivedAt: 3 }], 2);
  assert.deepEqual(result.survivors, ['a', 'b', 'c']);
});
test('zero votes does not manufacture a winner', () => assert.deepEqual(settle([]).leaders, []));
test('duplicate identity is rejected', () => assert.throws(() => settle([{ wallet: 'a', choice: 0, receivedAt: 1 }, { wallet: 'a', choice: 1, receivedAt: 2 }])));
test('10-second close and 15-second next-question boundary', () => {
  assert.equal(questionPhase(999, 1000).phase, 'lobby');
  assert.equal(questionPhase(10999, 1000).phase, 'question');
  assert.equal(questionPhase(11000, 1000).phase, 'result');
  assert.equal(questionPhase(16000, 1000).index, 1);
  assert.equal(questionPhase(151000, 1000).phase, 'final');
});
test('integer payouts conserve pot including remainder and no winners', () => {
  assert.deepEqual(splitPot(100n, 3), { each: 33n, remainder: 1n });
  assert.deepEqual(splitPot(100n, 0), { each: 0n, remainder: 100n });
});
