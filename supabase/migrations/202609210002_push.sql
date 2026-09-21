-- Private FCM registrations. Access only through the wallet-authenticated Edge Function.
create table public.hundo_push_devices (
 installation_id uuid primary key,
 wallet text not null,
 token text not null unique check(length(token) between 20 and 4096),
 enabled boolean not null default true,
 updated_at timestamptz not null default clock_timestamp()
);
create index on public.hundo_push_devices(wallet);
alter table public.hundo_push_devices enable row level security;
revoke all on public.hundo_push_devices from public,anon,authenticated;
grant select,insert,update,delete on public.hundo_push_devices to service_role;

create function public.hundo_register_push(p_wallet text,p_installation uuid,p_token text)
returns void language plpgsql security definer set search_path=public as $$
begin
 -- Serialize registrations for a wallet so concurrent requests cannot exceed the limit.
 perform pg_advisory_xact_lock(hashtextextended(p_wallet,0));
 if exists(select 1 from hundo_push_devices where installation_id=p_installation and wallet<>p_wallet)
 then raise exception 'This installation belongs to another wallet'; end if;
 if not exists(select 1 from hundo_push_devices where installation_id=p_installation and enabled)
 and (select count(*) from hundo_push_devices where wallet=p_wallet and enabled)>=5
 then raise exception 'Device limit reached'; end if;
 insert into hundo_push_devices(installation_id,wallet,token) values(p_installation,p_wallet,p_token)
 on conflict(installation_id) do update set token=excluded.token,enabled=true,updated_at=clock_timestamp()
 where hundo_push_devices.wallet=excluded.wallet;
 if not found then raise exception 'Installation ownership changed'; end if;
end $$;
revoke all on function public.hundo_register_push(text,uuid,text) from public,anon,authenticated;
grant execute on function public.hundo_register_push(text,uuid,text) to service_role;
