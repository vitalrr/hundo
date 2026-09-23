-- Fifteen seconds to answer, then a three-second result reveal without a countdown.
-- Apply between rounds: the server is the source of truth for all deadlines.
create or replace function public.hundo_settle(p_round uuid) returns void language plpgsql security definer set search_path = public as $$
declare r hundo_rounds; q integer; c integer[]; winning integer[]; cutoff timestamptz;
begin
 select * into strict r from hundo_rounds where id=p_round for update;
 for q in (r.settled_through+1)..9 loop
  exit when clock_timestamp() < r.starts_at + make_interval(secs => q*18+15);
  select array(select count(a.wallet)::integer from generate_series(0,3) n left join hundo_answers a on a.round_id=p_round and a.number=q and a.choice=n group by n order by n) into c;
  select coalesce(array_agg(i-1),'{}') into winning from generate_series(1,4) i where c[i]=(select max(x) from unnest(c) x) and c[i]>0;
  update hundo_questions set counts=c, leaders=winning where round_id=p_round and number=q;
  update hundo_players p set eliminated_at=q where p.round_id=p_round and p.eliminated_at is null and not exists(select 1 from hundo_answers a where a.round_id=p_round and a.number=q and a.wallet=p.wallet and a.choice=any(winning));
  if r.survivor_cap is not null then
   select a.received_at into cutoff from hundo_answers a join hundo_players p using(round_id,wallet) where a.round_id=p_round and a.number=q and p.eliminated_at is null order by a.received_at offset (r.survivor_cap-1) limit 1;
   if cutoff is not null then
    update hundo_players p set eliminated_at=q from hundo_answers a where p.round_id=p_round and a.round_id=p.round_id and a.wallet=p.wallet and a.number=q and p.eliminated_at is null and a.received_at>cutoff;
   end if;
  end if;
  update hundo_rounds set settled_through=q where id=p_round;
 end loop;
 if (select settled_through from hundo_rounds where id=p_round)=9 then
  insert into hundo_payouts(round_id,wallet,lamports)
   select p_round,wallet,r.pot_lamports/(select count(*) from hundo_players where round_id=p_round and eliminated_at is null)
   from hundo_players where round_id=p_round and eliminated_at is null on conflict do nothing;
 end if;
end $$;

create or replace function public.hundo_answer(p_round uuid,p_wallet text,p_number integer,p_choice integer) returns void language plpgsql security definer set search_path=public as $$
declare r hundo_rounds; t timestamptz;
begin
 select * into strict r from hundo_rounds where id=p_round for update;
 perform hundo_settle(p_round);
 t:=clock_timestamp();
 if p_number not between 0 and 9 or p_choice not between 0 and 3 then raise exception 'Invalid answer'; end if;
 if t<r.starts_at+make_interval(secs=>p_number*18) or t>=r.starts_at+make_interval(secs=>p_number*18+15) then raise exception 'Question is closed'; end if;
 if not exists(select 1 from hundo_players where round_id=p_round and wallet=p_wallet and eliminated_at is null) then raise exception 'Not an active player'; end if;
 -- An identical retry is safe. A different second answer is rejected.
 if exists(select 1 from hundo_answers where round_id=p_round and number=p_number and wallet=p_wallet and choice<>p_choice) then raise exception 'Answer already locked'; end if;
 insert into hundo_answers values(p_round,p_number,p_wallet,p_choice,t) on conflict do nothing;
end $$;

create or replace function public.hundo_snapshot(p_round uuid,p_wallet text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r hundo_rounds; t timestamptz; n integer; phase text; result jsonb;
begin
 perform hundo_settle(p_round);
 select * into strict r from hundo_rounds where id=p_round;
 t:=clock_timestamp(); n:=floor(extract(epoch from (t-r.starts_at))/18);
 phase:=case when n<0 then 'lobby' when n>=10 then 'final' when t>=r.starts_at+make_interval(secs=>n*18+15) then 'result' else 'question' end;
 n:=greatest(0,least(9,n));
 result:=jsonb_build_object('roundId',r.id,'serverTime',t,'startsAt',r.starts_at,'phase',phase,'index',n,'potWallet',r.pot_wallet,'potLamports',r.pot_lamports::text,'network',r.network,'survivorCap',r.survivor_cap,
 'playerCount',(select count(*) from hundo_players where round_id=p_round),
 'survivorCount',(select count(*) from hundo_players where round_id=p_round and eliminated_at is null),
 'joined',exists(select 1 from hundo_players where round_id=p_round and wallet=p_wallet),
 'eliminatedAt',(select eliminated_at from hundo_players where round_id=p_round and wallet=p_wallet),
 'myChoice',(select choice from hundo_answers where round_id=p_round and number=n and wallet=p_wallet));
 if phase in ('question','result') then
  result:=result||jsonb_build_object('question',(select jsonb_build_object('text',text,'options',options) from hundo_questions where round_id=p_round and number=n));
 end if;
 if phase='result' then
  result:=result||jsonb_build_object('counts',(select counts from hundo_questions where round_id=p_round and number=n),'leaders',(select leaders from hundo_questions where round_id=p_round and number=n));
 end if;
 if phase='final' then
  result:=result||jsonb_build_object('recap',coalesce((select jsonb_agg(jsonb_build_object('number',q.number,'text',q.text,'options',q.options,'counts',q.counts,'myChoice',a.choice) order by q.number) from hundo_questions q left join hundo_answers a on a.round_id=q.round_id and a.number=q.number and a.wallet=p_wallet where q.round_id=p_round),'[]'::jsonb));
  result:=result||jsonb_build_object('payouts',coalesce((select jsonb_agg(jsonb_build_object('wallet',wallet,'lamports',lamports::text,'signature',signature,'status',status)) from hundo_payouts where round_id=p_round),'[]'::jsonb));
 end if;
 return result;
end $$;

create or replace function public.hundo_home() returns jsonb language plpgsql security definer set search_path=public as $$
declare r hundo_rounds; t timestamptz := clock_timestamp();
begin
 select * into r from hundo_rounds rounds
 where starts_at > t - interval '180 seconds'
 and (select count(*) from hundo_questions where round_id=rounds.id)=10
 order by starts_at limit 1;
 if not found then return jsonb_build_object('serverTime',t,'round',null); end if;
 return jsonb_build_object('serverTime',t,'round',jsonb_build_object(
  'id',r.id,'startsAt',r.starts_at,'phase',case when r.starts_at>t then 'lobby' else 'live' end,
  'potLamports',r.pot_lamports::text,'network',r.network,'isRehearsal',r.is_rehearsal,
  'playerCount',(select count(*) from hundo_players where round_id=r.id)
 ));
end $$;
