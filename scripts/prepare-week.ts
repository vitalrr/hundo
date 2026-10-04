// Produces an atomic, repeatable seven-day rehearsal schedule. It sends nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export function prepareWeek(firstStart: string, source: string, now=Date.now()) {
 if (!/(Z|[+-]\d{2}:\d{2})$/.test(firstStart)||!Number.isFinite(Date.parse(firstStart))||Date.parse(firstStart)<=now) throw new Error('Use a future ISO start time with timezone.');
 const rows=source.trim().split(/\r?\n/).map(line=>line.split('|').map(s=>s.trim()));
 if(rows.length!==70||rows.some(row=>row.length!==5||row.some(s=>!s)||new Set(row.slice(1)).size!==4))throw new Error('Expected 70 questions, each with four distinct options.');
 if(new Set(rows.map(r=>r[0].toLowerCase())).size!==70)throw new Error('Duplicate question');
 const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
 const starts=Array.from({length:7},(_,i)=>new Date(Date.parse(firstStart)+i*86400000).toISOString());
 const blocks=starts.map((start,day)=>{
 const questions=rows.slice(day*10,day*10+10);
 return `
 select id into existing from public.hundo_rounds where starts_at=${q(start)}::timestamptz;
 if existing is not null then
  if not exists(select 1 from public.hundo_rounds where id=existing and is_rehearsal and pot_lamports=0)
   or (select count(*) from public.hundo_questions where round_id=existing)<>10
   or exists(select 1 from (values ${questions.map((r,i)=>`(${i},${q(r[0])},array[${r.slice(1).map(q).join(',')}])`).join(',')}) as expected(n,t,o)
    left join public.hundo_questions actual on actual.round_id=existing and actual.number=expected.n
    where actual.text is distinct from expected.t or actual.options is distinct from expected.o)
  then raise exception 'Existing round differs at ${start}'; end if;
 else
  if ${q(start)}::timestamptz<=clock_timestamp() then raise exception 'Start is no longer in the future'; end if;
  if exists(select 1 from public.hundo_rounds where starts_at between ${q(start)}::timestamptz-interval '150 seconds' and ${q(start)}::timestamptz+interval '150 seconds') then raise exception 'Overlapping round at ${start}'; end if;
  insert into public.hundo_rounds(starts_at,pot_wallet,pot_lamports,is_rehearsal)
   values(${q(start)},'11111111111111111111111111111111',0,true) returning id into existing;
  insert into public.hundo_questions(round_id,number,text,options) values
  ${questions.map((r,i)=>`(existing,${i},${q(r[0])},array[${r.slice(1).map(q).join(',')}])`).join(',\n  ')};
 end if;`;
 });
 return `begin;\nlock table public.hundo_rounds in share row exclusive mode;\ndo $$\ndeclare existing uuid;\nbegin\n${blocks.join('\n')}\nend $$;\ncommit;\nselect id,starts_at,is_rehearsal from public.hundo_rounds where starts_at in (${starts.map(q).join(',')}) order by starts_at;\n`;
}
if(process.argv[1]?.endsWith('/prepare-week.ts')){
 const sourcePath=process.argv[4]??resolve(dirname(process.argv[1]),'../content/week-one.tsv');
 const sql=prepareWeek(process.argv[2]??'',readFileSync(sourcePath,'utf8'));
 if(process.argv[3])writeFileSync(process.argv[3],sql);else process.stdout.write(sql);
}
