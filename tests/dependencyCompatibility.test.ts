import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

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

test('updated YAML loads Metro configuration and rejects executable YAML tags', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'hundo-yaml-'));
  const file = join(cwd, 'metro.config.yaml');
  try {
    writeFileSync(file, 'watchFolders: [src]\nresetCache: false\nmaxWorkers: 2\n');
    const explorer = require('cosmiconfig')('metro', { cache: false });
    assert.deepEqual(explorer.loadSync(file).config, {
      watchFolders: ['src'], resetCache: false, maxWorkers: 2
    });
    writeFileSync(file, 'unsafe: !!js/function "function () { return 1; }"\n');
    assert.throws(() => explorer.loadSync(file), /unknown tag/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('updated YAML preserves coverage configuration and CLI without sprintf-js', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'hundo-nyc-'));
  try {
    writeFileSync(join(cwd, 'package.json'), '{}');
    const file = join(cwd, '.nycrc.yaml');
    writeFileSync(file, 'all: true\ninclude: [src/**/*.ts]\nreporter: [text]\n');
    const { loadNycConfig } = require('@istanbuljs/load-nyc-config');
    const config = await loadNycConfig({ cwd, nycrcPath: file });
    assert.equal(config.all, true);
    assert.deepEqual(config.include, ['src/**/*.ts']);
    const cli = join(dirname(require.resolve('js-yaml/package.json')), 'bin/js-yaml.js');
    const result = execFileSync(process.execPath, [cli, file], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(result), { all: true, include: ['src/**/*.ts'], reporter: ['text'] });
    assert.doesNotMatch(readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'), /sprintf-js|argparse@1\./);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
