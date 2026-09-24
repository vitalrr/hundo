-- Track the 15-minute reminder separately from the 5-minute reminder.
create table public.hundo_early_push_deliveries (
  round_id uuid not null references public.hundo_rounds on delete cascade,
  installation_id uuid not null references public.hundo_push_devices(installation_id) on delete cascade,
  token text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts integer not null default 0,
  sent_at timestamptz,
  last_error text,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (round_id, installation_id)
);
alter table public.hundo_early_push_deliveries enable row level security;
revoke all on public.hundo_early_push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.hundo_early_push_deliveries to service_role;

create or replace function public.hundo_games_played(p_wallet text) returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer from public.hundo_players p
  join public.hundo_rounds r on r.id = p.round_id
  where p.wallet = p_wallet and r.starts_at < clock_timestamp() - interval '200 seconds';
$$;
revoke all on function public.hundo_games_played(text) from public, anon, authenticated;
grant execute on function public.hundo_games_played(text) to service_role;
