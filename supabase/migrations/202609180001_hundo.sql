-- hundo: private game data. Only the Edge Function's service role can call RPCs.
create table public.hundo_rounds (
 id uuid primary key default gen_random_uuid(), starts_at timestamptz not null,
 pot_wallet text not null, pot_lamports bigint not null default 0 check(pot_lamports >= 0),
 network text not null default 'devnet' check(network = 'devnet'),
 survivor_cap integer check(survivor_cap > 0), settled_through integer not null default -1,
 check(settled_through between -1 and 9)
);
create table public.hundo_questions (
 round_id uuid references public.hundo_rounds on delete cascade,
 number integer check(number between 0 and 9), text text not null,
 options text[] not null check(cardinality(options) = 4),
 counts integer[], leaders integer[], primary key(round_id, number)
);
create table public.hundo_players (
 round_id uuid references public.hundo_rounds on delete cascade,
 wallet text not null, entry_signature text not null unique,
 eliminated_at integer, joined_at timestamptz not null default clock_timestamp(),
 primary key(round_id, wallet)
);
create table public.hundo_answers (
 round_id uuid, number integer, wallet text, choice integer not null check(choice between 0 and 3),
 received_at timestamptz not null default clock_timestamp(),
 primary key(round_id, number, wallet),
 foreign key(round_id, number) references public.hundo_questions,
 foreign key(round_id, wallet) references public.hundo_players
);
create table public.hundo_challenges (
 id uuid primary key, wallet text not null, message text not null,
 expires_at timestamptz not null default (clock_timestamp() + interval '5 minutes')
);
create table public.hundo_sessions (
 token_hash text primary key, wallet text not null,
 expires_at timestamptz not null default (clock_timestamp() + interval '8 hours')
);
create table public.hundo_payouts (
 round_id uuid references public.hundo_rounds, wallet text not null,
 lamports bigint not null check(lamports >= 0), signature text,
 status text not null default 'pending' check(status in ('pending','submitted','confirmed')),
 primary key(round_id, wallet)
);
create index on public.hundo_rounds(starts_at);
create index on public.hundo_challenges(expires_at);
create index on public.hundo_sessions(expires_at);

-- All close/answer/join paths serialize on the round, so closing cannot race an answer.
create function public.hundo_settle(p_round uuid) returns void language plpgsql security definer set search_path = public as $$
declare r hundo_rounds; q integer; c integer[]; winning integer[]; cutoff timestamptz;
begin
 select * into strict r from hundo_rounds where id=p_round for update;
 for q in (r.settled_through+1)..9 loop
  exit when clock_timestamp() < r.starts_at + make_interval(secs => q*15+10);
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

create function public.hundo_answer(p_round uuid,p_wallet text,p_number integer,p_choice integer) returns void language plpgsql security definer set search_path=public as $$
declare r hundo_rounds; t timestamptz;
begin
 select * into strict r from hundo_rounds where id=p_round for update;
 perform hundo_settle(p_round);
 t:=clock_timestamp();
 if p_number not between 0 and 9 or p_choice not between 0 and 3 then raise exception 'Invalid answer'; end if;
 if t<r.starts_at+make_interval(secs=>p_number*15) or t>=r.starts_at+make_interval(secs=>p_number*15+10) then raise exception 'Question is closed'; end if;
 if not exists(select 1 from hundo_players where round_id=p_round and wallet=p_wallet and eliminated_at is null) then raise exception 'Not an active player'; end if;
 -- An identical retry is safe. A different second answer is rejected.
 if exists(select 1 from hundo_answers where round_id=p_round and number=p_number and wallet=p_wallet and choice<>p_choice) then raise exception 'Answer already locked'; end if;
 insert into hundo_answers values(p_round,p_number,p_wallet,p_choice,t) on conflict do nothing;
end $$;

create function public.hundo_join(p_round uuid,p_wallet text,p_signature text) returns void language plpgsql security definer set search_path=public as $$
declare r hundo_rounds;
begin
 select * into strict r from hundo_rounds where id=p_round for update;
 if clock_timestamp()>=r.starts_at then raise exception 'Registration closed'; end if;
 if (select count(*) from hundo_questions where round_id=p_round)<>10 then raise exception 'Round is not ready'; end if;
 insert into hundo_players(round_id,wallet,entry_signature) values(p_round,p_wallet,p_signature) on conflict(round_id,wallet) do nothing;
end $$;

create function public.hundo_snapshot(p_round uuid,p_wallet text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r hundo_rounds; t timestamptz; n integer; phase text; result jsonb;
begin
 perform hundo_settle(p_round);
 select * into strict r from hundo_rounds where id=p_round;
 t:=clock_timestamp(); n:=floor(extract(epoch from (t-r.starts_at))/15);
 phase:=case when n<0 then 'lobby' when n>=10 then 'final' when t>=r.starts_at+make_interval(secs=>n*15+10) then 'result' else 'question' end;
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
  result:=result||jsonb_build_object('payouts',coalesce((select jsonb_agg(jsonb_build_object('wallet',wallet,'lamports',lamports::text,'signature',signature,'status',status)) from hundo_payouts where round_id=p_round),'[]'::jsonb));
 end if;
 return result;
end $$;

do $$ declare t text; f record; begin
 foreach t in array array['hundo_rounds','hundo_questions','hundo_players','hundo_answers','hundo_challenges','hundo_sessions','hundo_payouts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'hundo_%' loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
