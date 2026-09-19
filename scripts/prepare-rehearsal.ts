// Prints SQL only. Review and run in the project's SQL editor when devices are ready.
// Example: node --experimental-strip-types scripts/prepare-rehearsal.ts 2026-09-20T12:00:00Z
import { demoQuestions } from '../src/game/demo.ts';
const startsAt = process.argv[2];
if (!startsAt || !/(Z|[+-]\d{2}:\d{2})$/.test(startsAt) || !Number.isFinite(Date.parse(startsAt)) || Date.parse(startsAt) <= Date.now()) {
 throw new Error('Pass a future ISO timestamp with a timezone, for example 2026-09-20T12:00:00Z.');
}
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
console.log(`begin;
do $$
declare rehearsal uuid;
begin
 if exists (select 1 from public.hundo_rounds where starts_at > clock_timestamp() - interval '150 seconds') then
  raise exception 'An upcoming or active round already exists. Review it before scheduling another.';
 end if;
 insert into public.hundo_rounds(starts_at,pot_wallet,pot_lamports,is_rehearsal)
 values (${quote(new Date(startsAt).toISOString())},'11111111111111111111111111111111',0,true) returning id into rehearsal;
 insert into public.hundo_questions(round_id,number,text,options) values
 ${demoQuestions.map((q,i)=>`(rehearsal,${i},${quote(q.text)},array[${q.options.map(quote).join(',')}])`).join(',\n ')};
end $$;
commit;
select public.hundo_home();`);
