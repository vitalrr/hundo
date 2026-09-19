import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('home exposes only ready rounds and real unique registrations; rehearsal cannot bypass paid-game entry', async () => {
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for (const file of ['202609180001_hundo.sql','202609190001_home.sql']) {
   await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  }
  const home = async () => (await db.query<{s:any}>('select hundo_home() s')).rows[0].s;
  assert.equal((await home()).round,null);
  const r='40000000-0000-4000-8000-000000000004';
  await db.query("insert into hundo_rounds(id,starts_at,pot_wallet,pot_lamports,is_rehearsal) values($1,clock_timestamp()+interval '1 hour','pot',0,true)",[r]);
  assert.equal((await home()).round,null,'incomplete rounds stay hidden');
  for(let n=0;n<10;n++) await db.query("insert into hundo_questions(round_id,number,text,options) values($1,$2,'Secret question',array['A','B','C','D'])",[r,n]);
  let summary=await home();
  assert.equal(summary.round.playerCount,0);assert.equal(summary.round.phase,'lobby');assert.equal(summary.round.isRehearsal,true);
  await db.query('select hundo_join_rehearsal($1,$2)',[r,'wallet-a']);
  await db.query('select hundo_join_rehearsal($1,$2)',[r,'wallet-a']);
  await db.query('select hundo_join_rehearsal($1,$2)',[r,'wallet-b']);
  summary=await home();assert.equal(summary.round.playerCount,2);
  assert.ok(!JSON.stringify(summary).includes('wallet-a'));assert.ok(!JSON.stringify(summary).includes('Secret question'));
  await assert.rejects(db.query('update hundo_rounds set pot_lamports=1 where id=$1',[r]),/rehearsal_has_no_prize/);
  await db.query('update hundo_rounds set is_rehearsal=false where id=$1',[r]);
  await assert.rejects(db.query('select hundo_join_rehearsal($1,$2)',[r,'wallet-c']),/Not a rehearsal/);
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '1 second',is_rehearsal=true where id=$1",[r]);
  assert.equal((await home()).round.phase,'live');
  await assert.rejects(db.query('select hundo_join_rehearsal($1,$2)',[r,'wallet-c']),/Registration closed/);
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '151 seconds' where id=$1",[r]);
  assert.equal((await home()).round,null,'completed rounds no longer advertised');
  await db.exec('set role anon');
  await assert.rejects(db.query('select hundo_home()'));
  await assert.rejects(db.query('select hundo_join_rehearsal($1,$2)',[r,'wallet-c']));
 } finally { await db.close(); }
});
