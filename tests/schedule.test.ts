import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {prepareWeek} from '../scripts/prepare-week.ts';
test('weekly schedule is complete, idempotent, private and refuses conflicting content',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const file of ['202609180001_hundo.sql','202609190001_home.sql'])await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  const source=await readFile(new URL('../content/week-one.tsv',import.meta.url),'utf8');
  const sql=prepareWeek('2099-01-01T19:00:00Z',source);
  await db.exec(sql);await db.exec(sql);
  const result=await db.query<{n:number}>('select count(*)::int n from hundo_rounds');assert.equal(result.rows[0].n,7);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from hundo_questions')).rows[0].n,70);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from hundo_rounds where not is_rehearsal or pot_lamports<>0')).rows[0].n,0);
  await assert.rejects(db.exec(prepareWeek('2099-01-01T19:00:00Z',source.replace('A red chart','A green chart'))),/Existing round differs/);
  await db.exec('rollback');
  await assert.rejects(db.exec(prepareWeek('2099-01-01T19:01:00Z',source)),/Overlapping round/);
  await db.exec('rollback');
  await db.exec('set role anon');await assert.rejects(db.query('select * from hundo_questions'));
 }finally{await db.close();}
});
