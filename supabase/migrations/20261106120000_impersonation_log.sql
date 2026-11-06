-- A record of every time the MD signs in as another person ("Sign in as" on the People page).
-- The app writes it with the service key before the switch and closes it when the MD switches
-- back; nobody signed in can add, change or delete a row. Only the MD can read it.
create table public.impersonation_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  target_id uuid not null references public.profiles (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index impersonation_log_started_at_idx on public.impersonation_log (started_at desc);

alter table public.impersonation_log enable row level security;

revoke all on table public.impersonation_log from anon, authenticated;
grant select on table public.impersonation_log to authenticated;

create policy "impersonation log: md reads"
  on public.impersonation_log for select
  to authenticated
  using ((select public.has_job_role('md')));
