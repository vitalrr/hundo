-- One post-game notification per device and completed real round.
create table public.hundo_result_push_deliveries (
  round_id uuid not null references public.hundo_rounds on delete cascade,
  installation_id uuid not null references public.hundo_push_devices(installation_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  sent_at timestamptz,
  last_error text,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (round_id, installation_id)
);
alter table public.hundo_result_push_deliveries enable row level security;
revoke all on public.hundo_result_push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.hundo_result_push_deliveries to service_role;
