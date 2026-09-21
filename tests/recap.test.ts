import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('recap stays hidden until final and contains only the caller’s own choices',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for(const file of ['202609180001_hundo.sql','202609190001_home.sql','202609210001_recap.sql'])await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  const id='50000000-0000-4000-8000-000000000005';
  await db.query("insert into hundo_rounds(id,starts_at,pot_wallet,pot_lamports,is_rehearsal) values($1,clock_timestamp()+interval '1 hour','pot',0,true)",[id]);
  for(let i=0;i<10;i++)await db.query("insert into hundo_questions(round_id,number,text,options) values($1,$2,'Prompt',array['A','B','C','D'])",[id,i]);
  await db.query('select hundo_join_rehearsal($1,$2)',[id,'me']);await db.query('select hundo_join_rehearsal($1,$2)',[id,'other']);
  const snapshot=async()=>(await db.query<{s:any}>('select hundo_snapshot($1,$2) s',[id,'me'])).rows[0].s;
  assert.equal((await snapshot()).recap,undefined);
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '1 second' where id=$1",[id]);
  await db.query('select hundo_answer($1,$2,0,0)',[id,'me']);await db.query('select hundo_answer($1,$2,0,1)',[id,'other']);
  assert.equal((await snapshot()).recap,undefined);
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '151 seconds' where id=$1",[id]);
  const s=await snapshot();assert.equal(s.phase,'final');assert.equal(s.recap.length,10);assert.equal(s.recap[0].myChoice,0);assert.deepEqual(s.recap[0].counts,[1,1,0,0]);assert.equal(s.recap[1].myChoice,null);assert.deepEqual(s.recap[1].counts,[0,0,0,0]);
 }finally{await db.close();}
});
