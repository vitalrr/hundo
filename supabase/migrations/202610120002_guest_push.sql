-- Notifications follow an app installation, including while no wallet is connected.
alter table public.hundo_push_devices alter column wallet drop not null;
alter table public.hundo_push_devices add column secret_hash text
 check (secret_hash ~ '^[a-f0-9]{64}$');

create function public.hundo_register_guest_push(p_installation uuid,p_secret_hash text,p_token text)
returns void language plpgsql security definer set search_path=public as $$
declare old_device public.hundo_push_devices%rowtype;
begin
 if p_secret_hash !~ '^[a-f0-9]{64}$' or length(p_token) not between 20 and 4096 or p_token ~ '[[:space:]]'
 then raise exception 'Invalid push credentials'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_installation::text,0));
 select * into old_device from public.hundo_push_devices where installation_id=p_installation for update;
 if found then
  -- An existing wallet-era registration can only be adopted from the same FCM token.
  if old_device.secret_hash is null and old_device.token<>p_token
  then raise exception 'Legacy token mismatch'; end if;
  if old_device.secret_hash is not null and old_device.secret_hash<>p_secret_hash
  then raise exception 'Installation belongs to another client'; end if;
  update public.hundo_push_devices set wallet=null,secret_hash=p_secret_hash,token=p_token,
   enabled=true,updated_at=clock_timestamp() where installation_id=p_installation;
 else
  insert into public.hundo_push_devices(installation_id,wallet,secret_hash,token)
  values(p_installation,null,p_secret_hash,p_token);
 end if;
end $$;

create function public.hundo_disable_guest_push(p_installation uuid,p_secret_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.hundo_push_devices set enabled=false,updated_at=clock_timestamp()
 where installation_id=p_installation and secret_hash=p_secret_hash;
 return found;
end $$;

revoke all on function public.hundo_register_guest_push(uuid,text,text) from public,anon,authenticated;
revoke all on function public.hundo_disable_guest_push(uuid,text) from public,anon,authenticated;
grant execute on function public.hundo_register_guest_push(uuid,text,text) to service_role;
grant execute on function public.hundo_disable_guest_push(uuid,text) to service_role;
