import test from 'node:test';
import assert from 'node:assert/strict';
import { audioFileUri } from '../src/game/audioSource.ts';
test('Android audio receives a decoded file path; remote and other platform URLs stay intact', () => {
  assert.equal(audioFileUri('file:///data/user/0/hundo/cache/a%20b.wav', 'android'), '/data/user/0/hundo/cache/a b.wav');
  assert.equal(audioFileUri('https://localhost/tick.wav', 'android'), 'https://localhost/tick.wav');
  assert.equal(audioFileUri('file:///cache/tick.wav', 'ios'), 'file:///cache/tick.wav');
  assert.equal(audioFileUri('/assets/tick.wav', 'web'), '/assets/tick.wav');
});
