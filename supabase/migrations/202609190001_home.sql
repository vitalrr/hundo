-- Only ready rounds are advertised. Public summaries never reveal questions or wallets.
alter table public.hundo_rounds add column is_rehearsal boolean not null default false;
alter table public.hundo_rounds add constraint rehearsal_has_no_prize check (not is_rehearsal or pot_lamports = 0);

create function public.hundo_home() returns jsonb language plpgsql security definer set search_path=public as $$
declare r hundo_rounds; t timestamptz := clock_timestamp();
begin
 select * into r from hundo_rounds rounds
 where starts_at > t - interval '150 seconds'
 and (select count(*) from hundo_questions where round_id=rounds.id)=10
 order by starts_at limit 1;
 if not found then return jsonb_build_object('serverTime',t,'round',null); end if;
 return jsonb_build_object('serverTime',t,'round',jsonb_build_object(
  'id',r.id,'startsAt',r.starts_at,'phase',case when r.starts_at>t then 'lobby' else 'live' end,
  'potLamports',r.pot_lamports::text,'network',r.network,'isRehearsal',r.is_rehearsal,
  'playerCount',(select count(*) from hundo_players where round_id=r.id)
 ));
end $$;
revoke all on function public.hundo_home() from public,anon,authenticated;
grant execute on function public.hundo_home() to service_role;

-- A signed wallet session may join an explicitly prize-free rehearsal without a network fee.
-- Normal games continue to require a verified on-chain memo transaction at the API boundary.
create function public.hundo_join_rehearsal(p_round uuid,p_wallet text) returns void language plpgsql security definer set search_path=public as $$
declare r hundo_rounds;
begin
 select * into strict r from hundo_rounds where id=p_round for update;
 if not r.is_rehearsal or r.pot_lamports<>0 then raise exception 'Not a rehearsal'; end if;
 perform hundo_join(p_round,p_wallet,'rehearsal:'||p_round::text||':'||p_wallet);
end $$;
revoke all on function public.hundo_join_rehearsal(uuid,text) from public,anon,authenticated;
grant execute on function public.hundo_join_rehearsal(uuid,text) to service_role;
