-- One explicitly scheduled, operator-funded Mainnet SKR pilot. Existing daily
-- rehearsals keep their zero-prize Devnet accounting and do not use this table.
create table public.hundo_skr_pilots (
  round_id uuid primary key references public.hundo_rounds(id) on delete restrict,
  pilot_slot smallint not null default 1 unique check (pilot_slot = 1),
  treasury_wallet text not null,
  mint text not null default 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'
    check (mint = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'),
  amount_raw bigint not null default 1000000 check (amount_raw = 1000000),
  status text not null default 'announced'
    check (status in ('announced', 'prepared', 'submitted', 'confirmed')),
  winner_wallet text,
  signature text,
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status = 'announced' and winner_wallet is null and signature is null) or
    (status in ('prepared', 'submitted', 'confirmed') and winner_wallet is not null and signature is not null)
  )
);

alter table public.hundo_skr_pilots enable row level security;
revoke all on public.hundo_skr_pilots from public, anon, authenticated;
grant select, insert, update on public.hundo_skr_pilots to service_role;
