import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('valid game sessions survive app restarts for thirty days without reviving expired sessions', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(await readFile(new URL('../supabase/migrations/202609180001_hundo.sql', import.meta.url), 'utf8'));
    await db.exec("insert into hundo_sessions(token_hash,wallet,expires_at) values ('active','a',clock_timestamp()+interval '1 hour'),('expired','b',clock_timestamp()-interval '1 hour')");
    await db.exec(await readFile(new URL('../supabase/migrations/202609220002_persistent_sessions.sql', import.meta.url), 'utf8'));
    await db.exec("insert into hundo_sessions(token_hash,wallet) values ('new','c')");
    const result = await db.query<{token_hash:string;days:number}>("select token_hash,extract(epoch from expires_at-clock_timestamp())/86400 as days from hundo_sessions order by token_hash");
    const days = Object.fromEntries(result.rows.map(row => [row.token_hash, Number(row.days)]));
    assert.ok(days.active > 29 && days.active <= 30);
    assert.ok(days.new > 29 && days.new <= 30);
    assert.ok(days.expired < 0);
  } finally { await db.close(); }
});
