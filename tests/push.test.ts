import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('push registrations are private, wallet-bound, capped and refreshable',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/202609210002_push.sql',import.meta.url),'utf8'));
  const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const token=(n:number)=>`notification-token-for-device-${n}`;
  const register=(wallet:string,n:number,t=token(n))=>db.query('select hundo_register_push($1,$2,$3)',[wallet,id(n),t]);
  await register('alice',1);
  await register('alice',1,'refreshed-notification-token');
  assert.equal((await db.query<{token:string}>('select token from hundo_push_devices')).rows[0].token,'refreshed-notification-token');
  await assert.rejects(register('bob',1),/another wallet/);
  await assert.rejects(register('bob',2,'refreshed-notification-token'),/unique/);
  for(let n=2;n<=5;n++)await register('alice',n);
  await assert.rejects(register('alice',6),/Device limit/);
  await db.query('update hundo_push_devices set enabled=false where installation_id=$1',[id(1)]);
  await register('alice',6);
  await assert.rejects(register('alice',1),/Device limit/);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from hundo_push_devices'),/permission denied/);
  await assert.rejects(register('alice',7),/permission denied/);
 }finally{await db.close();}
});
