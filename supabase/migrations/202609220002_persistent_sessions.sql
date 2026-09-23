-- A securely stored device session survives app restarts and refreshes on launch.
alter table public.hundo_sessions alter column expires_at set default (clock_timestamp() + interval '30 days');
update public.hundo_sessions
set expires_at = greatest(expires_at, clock_timestamp() + interval '30 days')
where expires_at > clock_timestamp();
