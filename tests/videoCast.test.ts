import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { settle, type Choice } from '../src/game/rules.ts';

const require = createRequire(import.meta.url);
const { castChoice, castSize } = require('../scripts/video-cast-plan.cjs');

test('disclosed 57-player video cast shows varied votes and one Seeker finalist', () => {
  assert.equal(castSize, 56);
  const expectedCounts = [
    [44, 6, 4, 3], [34, 2, 5, 3], [26, 3, 2, 3], [19, 2, 3, 2],
    [13, 2, 2, 2], [9, 1, 2, 1], [6, 1, 1, 1], [4, 1, 1, 0],
    [2, 1, 1, 0], [1, 0, 0, 0],
  ];
  const expectedSurvivors = [44, 34, 26, 19, 13, 9, 6, 4, 2, 1];
  let active = ['phone', ...Array.from({ length: castSize }, (_, index) => `cast-${index}`)];
  for (let question = 0; question < 10; question++) {
    const votes = active.flatMap((wallet, index) => {
      const choice = wallet === 'phone' ? 0 : castChoice(Number(wallet.slice(5)), question);
      return choice === null ? [] : [{ wallet, choice: choice as Choice, receivedAt: index }];
    });
    const result = settle(votes);
    assert.deepEqual(result.counts, expectedCounts[question], `question ${question + 1} breakdown`);
    assert.deepEqual(result.leaders, [0]);
    active = result.survivors;
    assert.equal(active.length, expectedSurvivors[question], `question ${question + 1} survivors`);
  }
  assert.deepEqual(active, ['phone']);
});

test('the 57-player cast produces one finalist under the real database rules', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const file of ['202609180001_hundo.sql', '202609190001_home.sql', '202609220004_five_second_results.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    const round = '57000000-0000-4000-8000-000000000057';
    await db.query("insert into hundo_rounds(id,starts_at,pot_wallet,pot_lamports,is_rehearsal) values($1,clock_timestamp()+interval '1 hour','test-pot',0,true)", [round]);
    for (let index = 0; index < 10; index++) {
      await db.query("insert into hundo_questions(round_id,number,text,options) values($1,$2,'Test',array['A','B','C','D'])", [round, index]);
    }
    for (const wallet of ['phone', ...Array.from({ length: castSize }, (_, index) => `cast-${index}`)]) {
      await db.query('select hundo_join_rehearsal($1,$2)', [round, wallet]);
    }
    const expectedCounts = [
      [44, 6, 4, 3], [34, 2, 5, 3], [26, 3, 2, 3], [19, 2, 3, 2],
      [13, 2, 2, 2], [9, 1, 2, 1], [6, 1, 1, 1], [4, 1, 1, 0],
      [2, 1, 1, 0], [1, 0, 0, 0],
    ];
    for (let question = 0; question < 10; question++) {
      await db.query('update hundo_rounds set starts_at=clock_timestamp()-make_interval(secs=>$2) where id=$1', [round, question * 20 + 1]);
      const active = await db.query<{ wallet: string }>('select wallet from hundo_players where round_id=$1 and eliminated_at is null', [round]);
      for (const { wallet } of active.rows) {
        const choice = wallet === 'phone' ? 0 : castChoice(Number(wallet.slice(5)), question);
        if (choice !== null) await db.query('select hundo_answer($1,$2,$3,$4)', [round, wallet, question, choice]);
      }
      await db.query('update hundo_rounds set starts_at=clock_timestamp()-make_interval(secs=>$2) where id=$1', [round, question * 20 + 16]);
      await db.query('select hundo_settle($1)', [round]);
      const counts = await db.query<{ counts: number[] }>('select counts from hundo_questions where round_id=$1 and number=$2', [round, question]);
      assert.deepEqual(counts.rows[0].counts, expectedCounts[question], `question ${question + 1} server counts`);
    }
    const finalists = await db.query<{ wallet: string }>('select wallet from hundo_players where round_id=$1 and eliminated_at is null', [round]);
    assert.deepEqual(finalists.rows.map(row => row.wallet), ['phone']);
  } finally {
    await db.close();
  }
});
