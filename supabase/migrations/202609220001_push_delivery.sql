-- Private, idempotent delivery ledger for scheduled game reminders.
create table public.hundo_push_deliveries (
  round_id uuid not null references public.hundo_rounds on delete cascade,
  installation_id uuid not null references public.hundo_push_devices(installation_id) on delete cascade,
  token text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  sent_at timestamptz,
  last_error text,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (round_id, installation_id)
);
create index on public.hundo_push_deliveries(status, updated_at);
alter table public.hundo_push_deliveries enable row level security;
revoke all on public.hundo_push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.hundo_push_deliveries to service_role;
