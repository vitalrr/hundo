import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);

test('updated query-string preserves room links and malformed escapes', async () => {
  const queryString = await import('query-string');
  const parsed = queryString.parse('?room=hello%20world&tag=%25ZZ');
  assert.equal(parsed.room, 'hello world');
  assert.equal(parsed.tag, '%ZZ');
  assert.equal(queryString.stringify({ room: 'hello world' }), 'room=hello%20world');
});

test('Jayson request IDs and streaming RPC parsing work with updated dependencies', async () => {
  const jayson = require('jayson');
  assert.match(jayson.utils.generateId(), /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
  const request = { jsonrpc: '2.0', method: 'getBalance', params: ['wallet'], id: 1 };
  const parsed = await new Promise((resolve, reject) => {
    jayson.utils.parseStream(Readable.from([JSON.stringify(request)]), {}, (error: Error | null, value: unknown) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
  assert.deepEqual(parsed, request);
});

test('patched sprintf-js bounds numeric precision', () => {
  const { sprintf } = require('sprintf-js');
  assert.equal(sprintf('%.2f', 1.25), '1.25');
  for (const format of ['%.999999f', '%.999999e', '%.999999g']) {
    assert.ok(sprintf(format, 1.25).length < 200);
  }
});
