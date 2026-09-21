create or replace function public.hundo_snapshot(p_round uuid,p_wallet text) returns jsonb language plpgsql security definer set search_path=public as $$
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
  result:=result||jsonb_build_object('recap',coalesce((select jsonb_agg(jsonb_build_object('number',q.number,'text',q.text,'options',q.options,'counts',q.counts,'myChoice',a.choice) order by q.number) from hundo_questions q left join hundo_answers a on a.round_id=q.round_id and a.number=q.number and a.wallet=p_wallet where q.round_id=p_round),'[]'::jsonb));
  result:=result||jsonb_build_object('payouts',coalesce((select jsonb_agg(jsonb_build_object('wallet',wallet,'lamports',lamports::text,'signature',signature,'status',status)) from hundo_payouts where round_id=p_round),'[]'::jsonb));
 end if;
 return result;
end $$;

revoke all on function public.hundo_snapshot(uuid,text) from public,anon,authenticated;
grant execute on function public.hundo_snapshot(uuid,text) to service_role;
