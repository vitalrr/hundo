import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assertPublicClientConfig } = require('../scripts/client-config-guard.cjs');
const jwt = (role: string) => [
  Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role })).toString('base64url'),
  'synthetic-test-signature',
].join('.');

test('client configuration allows publishable and legacy anon keys, and offline demo', () => {
  for (const key of ['', 'sb_publishable_example', jwt('anon')]) {
    assert.doesNotThrow(() => assertPublicClientConfig({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }));
  }
  assert.doesNotThrow(() => assertPublicClientConfig({ SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-value' }));
});

test('client configuration rejects privileged keys without logging their values', () => {
  for (const value of ['sb_secret_synthetic', jwt('service_role'), '-----BEGIN PRIVATE KEY-----synthetic']) {
    assert.throws(() => assertPublicClientConfig({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: value }), (error: Error) => {
      assert.match(error.message, /Refusing to bundle/);
      assert.equal(error.message.includes(value), false);
      return true;
    });
  }
});

test('client configuration rejects secrets under another public variable', () => {
  for (const env of [
    { EXPO_PUBLIC_SERVICE_ROLE_KEY: 'synthetic-value' },
    { EXPO_PUBLIC_OTHER: jwt('service_role') },
    { EXPO_PUBLIC_OTHER: 'sb_secret_synthetic' },
    { EXPO_PUBLIC_PASSWORD: 'synthetic-value' },
  ]) assert.throws(() => assertPublicClientConfig(env), /Refusing to bundle/);
  assert.throws(() => assertPublicClientConfig({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'unrecognized-value' }), /must contain a publishable key/);
});

test('Expo configuration invokes the guard and preserves the existing app configuration', () => {
  const configure = require('../app.config.js');
  const config = require('../app.json').expo;
  const previous = process.env.EXPO_PUBLIC_PASSWORD;
  try {
    process.env.EXPO_PUBLIC_PASSWORD = 'synthetic-config-check';
    assert.throws(() => configure({ config }), /Refusing to bundle/);
    delete process.env.EXPO_PUBLIC_PASSWORD;
    assert.equal(configure({ config }), config);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_PASSWORD;
    else process.env.EXPO_PUBLIC_PASSWORD = previous;
  }
});
