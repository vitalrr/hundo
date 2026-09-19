import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migration = await readFile(new URL('../supabase/migrations/202609180001_hundo.sql', import.meta.url), 'utf8');
test('six-player round restores authoritative state after missed responses and rejects spectator votes', async () => {
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(migration);
  const round = '30000000-0000-4000-8000-000000000003';
  await db.query("insert into hundo_rounds(id,starts_at,pot_wallet,pot_lamports) values($1,clock_timestamp()+interval '1 hour','test-pot',101)",[round]);
  for(let n=0;n<10;n++) await db.query("insert into hundo_questions values($1,$2,'Test',array['A','B','C','D'],null,null)",[round,n]);
  for(const player of ['a','b','c','d','e','f']) await db.query('select hundo_join($1,$2,$3)',[round,player,`test-entry-${player}`]);
  const time = (seconds:number) => db.query('update hundo_rounds set starts_at=clock_timestamp()-make_interval(secs=>$2) where id=$1',[round,seconds]);
  const answer = (player:string,n:number,choice:number) => db.query('select hundo_answer($1,$2,$3,$4)',[round,player,n,choice]);
  const snapshot = async (player:string) => (await db.query<{s:any}>('select hundo_snapshot($1,$2) s',[round,player])).rows[0].s;
  for(let n=0;n<10;n++) {
   await time(n*15+1);
   if(n===0) {
    for(const player of ['a','b','c','d']) await answer(player,n,0);
    for(const player of ['e','f']) await answer(player,n,1);
   } else {
    // The next answer settles the previous question even when nobody polled its result.
    await answer('a',n,0);
    for(const player of ['e','f']) await assert.rejects(answer(player,n,1),/Not an active player/);
    for(const player of ['b','c']) await answer(player,n,n===1&&player==='c'?1:0);
    if(n===1) await answer('d',n,1); // 2:2 tie: all four remain active.
    if(n>2) await assert.rejects(answer('d',n,0),/Not an active player/);
   }
   // Simulate a lost HTTP reply followed by a retry and a fresh snapshot.
   const before = await db.query('select received_at from hundo_answers where round_id=$1 and number=$2 and wallet=$3',[round,n,'a']);
   await answer('a',n,0);
   const after = await db.query('select received_at from hundo_answers where round_id=$1 and number=$2 and wallet=$3',[round,n,'a']);
   assert.deepEqual(after.rows,before.rows,'retry must preserve the original speed ranking');
   await assert.rejects(answer('a',n,1),/Answer already locked/);
   const active = await snapshot('a');
   assert.equal(active.index,n);assert.equal(active.myChoice,0);assert.equal(active.counts,undefined);
   const spectator = await snapshot('outside');
   assert.equal(spectator.joined,false);assert.equal(spectator.counts,undefined);
   if(n===1) {
    await time(26);
    const result=await snapshot('e');
    assert.deepEqual(result.counts,[2,2,0,0]);assert.equal(result.survivorCount,4);assert.equal(result.eliminatedAt,0);
   }
  }
  await time(151);
  const final=await snapshot('a');
  assert.equal(final.phase,'final');assert.equal(final.playerCount,6);assert.equal(final.survivorCount,3);
  assert.deepEqual(final.payouts.map((p:any)=>p.wallet).sort(),['a','b','c']);
  assert.ok(final.payouts.every((p:any)=>p.lamports==='33'&&p.status==='pending'&&p.signature===null));
  assert.equal((await snapshot('d')).eliminatedAt,2);
  assert.deepEqual((await snapshot('a')).payouts,final.payouts);
 } finally {await db.close();}
});
test('database enforces secrecy, eligible votes, deadlines, ties and exactly-once settlement', async () => {
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(migration);
  const r = '10000000-0000-4000-8000-000000000001';
  await db.query("insert into hundo_rounds(id,starts_at,pot_wallet,pot_lamports) values($1,clock_timestamp()+interval '1 hour','pot',100)", [r]);
  for(let i=0;i<10;i++) await db.query("insert into hundo_questions(round_id,number,text,options) values($1,$2,'Q',array['a','b','c','d'])",[r,i]);
  for (const w of ['a','b','c','d','e']) await db.query('select hundo_join($1,$2,$3)',[r,w,`sig-${w}`]);
  await assert.rejects(db.query('select hundo_answer($1,$2,0,0)',[r,'a']));
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '1 second' where id=$1",[r]);
  for(const [w,c] of [['a',0],['b',0],['c',1],['d',1],['e',2]]) await db.query('select hundo_answer($1,$2,0,$3)',[r,w,c]);
  await db.query('select hundo_answer($1,$2,0,0)',[r,'a']);
  await assert.rejects(db.query('select hundo_answer($1,$2,0,1)',[r,'a']));
  await assert.rejects(db.query('select hundo_answer($1,$2,0,0)',[r,'stranger']));
  const live:any = (await db.query('select hundo_snapshot($1,$2) as s',[r,'a'])).rows[0];
  assert.equal(live.s.phase,'question'); assert.equal(live.s.counts,undefined);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from hundo_answers'));
  await assert.rejects(db.query('select hundo_snapshot($1,$2)',[r,'a']));
  await db.exec('reset role');
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '11 seconds' where id=$1",[r]);
  const closed:any = (await db.query('select hundo_snapshot($1,$2) as s',[r,'a'])).rows[0];
  assert.deepEqual(closed.s.counts,[2,2,1,0]); assert.deepEqual(closed.s.leaders,[0,1]); assert.equal(closed.s.survivorCount,4);
  await assert.rejects(db.query('select hundo_answer($1,$2,0,0)',[r,'a']));
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '16 seconds' where id=$1",[r]);
  await assert.rejects(db.query('select hundo_answer($1,$2,1,0)',[r,'e']));
  for(const w of ['a','b','c','d']) await db.query('select hundo_answer($1,$2,1,0)',[r,w]);
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '151 seconds' where id=$1",[r]);
  const final:any=(await db.query('select hundo_snapshot($1,$2) as s',[r,'a'])).rows[0];
  assert.equal(final.s.phase,'final');assert.equal(final.s.survivorCount,0);assert.deepEqual(final.s.payouts,[]);
  const again:any=(await db.query('select hundo_snapshot($1,$2) as s',[r,'a'])).rows[0];assert.deepEqual(again.s.payouts,[]);
 } finally { await db.close(); }
});

test('database speed cutoff keeps timestamp ties; final payouts are integer and idempotent', async () => {
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');await db.exec(migration);
  const r='20000000-0000-4000-8000-000000000002';
  await db.query("insert into hundo_rounds(id,starts_at,pot_wallet,pot_lamports,survivor_cap) values($1,clock_timestamp()+interval '1 hour','pot',101,2)",[r]);
  for(let i=0;i<10;i++)await db.query("insert into hundo_questions(round_id,number,text,options) values($1,$2,'Q',array['a','b','c','d'])",[r,i]);
  for(const w of ['a','b','c','d'])await db.query('select hundo_join($1,$2,$3)',[r,w,`entry-${w}`]);
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '1 second' where id=$1",[r]);
  for(const w of ['a','b','c','d'])await db.query('select hundo_answer($1,$2,0,0)',[r,w]);
  await db.query("update hundo_answers set received_at='2026-09-18 10:00:01+00' where round_id=$1 and wallet='a'",[r]);
  await db.query("update hundo_answers set received_at='2026-09-18 10:00:02+00' where round_id=$1 and wallet in ('b','c')",[r]);
  await db.query("update hundo_answers set received_at='2026-09-18 10:00:03+00' where round_id=$1 and wallet='d'",[r]);
  await db.query("update hundo_rounds set starts_at=clock_timestamp()-interval '11 seconds' where id=$1",[r]);
  await db.query('select hundo_settle($1)',[r]);
  const active=await db.query<{wallet:string}>('select wallet from hundo_players where round_id=$1 and eliminated_at is null order by wallet',[r]);assert.deepEqual(active.rows.map(x=>x.wallet),['a','b','c']);
  await db.query('update hundo_rounds set survivor_cap=null where id=$1',[r]);
  for(let i=1;i<10;i++){
   await db.query("update hundo_rounds set starts_at=clock_timestamp()-make_interval(secs=>$2) where id=$1",[r,i*15+1]);
   for(const w of ['a','b','c'])await db.query('select hundo_answer($1,$2,$3,0)',[r,w,i]);
   await db.query("update hundo_rounds set starts_at=clock_timestamp()-make_interval(secs=>$2) where id=$1",[r,i*15+11]);
   await db.query('select hundo_settle($1)',[r]);
  }
  await db.query('select hundo_settle($1)',[r]);
  const payouts=await db.query<{lamports:number|string;status:string}>('select lamports,status from hundo_payouts where round_id=$1',[r]);
  assert.equal(payouts.rows.length,3);assert.ok(payouts.rows.every(p=>BigInt(p.lamports)===33n&&p.status==='pending'));
 }finally{await db.close();}
});
