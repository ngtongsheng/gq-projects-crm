-- Site stage, site log and follow-ups (loop 03 task 20). Everyone signed in reads them.
-- The MD, Sales Director and Site Supervisors move a site along and log visits; a log is
-- never edited or deleted. A follow-up is closed by someone in the group that owns it, or
-- by a manager.

alter table public.mofs
  add column site_stage text not null default 'start'
    check (site_stage in ('start', 'ongoing', 'shipment', 'delivered', 'installation', 'completed'));

-- site_stage is not in the mofs update grant (the register editors cannot reach it); this
-- function is the only way to change it, and it lets the site team do so.
create function public.set_site_stage(mof_id uuid, stage text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_job_role('md', 'director', 'site')) then
    raise exception 'Only the MD, Sales Director or a Site Supervisor can change the site stage.'
      using errcode = '42501';
  end if;

  update public.mofs m
  set site_stage = set_site_stage.stage
  where m.id = set_site_stage.mof_id;

  if not found then
    raise exception 'MOF not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_site_stage(uuid, text) from public, anon;
grant execute on function public.set_site_stage(uuid, text) to authenticated;

create table public.site_logs (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  visited_on date not null,
  -- Whoever logs the visit; never part of the insert grant, so it cannot be faked.
  supervisor_id uuid not null default auth.uid() references public.profiles (id),
  activity text not null check (activity in ('measurement', 'inspection', 'installation',
    'handover', 'shooting', 'touch_up', 'delivery', 'others')),
  notes text check (notes is null or (notes = btrim(notes) and notes <> '')),
  measurement_received boolean not null default false,
  -- A link to the shared folder; files are not uploaded here.
  drive_link text check (drive_link is null or drive_link ~* '^https?://[^[:space:]]+$'),
  handover_signed boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create index site_logs_mof_id_idx on public.site_logs (mof_id);
create index site_logs_supervisor_id_idx on public.site_logs (supervisor_id);

create table public.site_follow_ups (
  id uuid primary key default gen_random_uuid(),
  site_log_id uuid not null references public.site_logs (id),
  action text not null check (action = btrim(action) and action <> ''),
  owner_group text not null check (owner_group in ('salesperson', 'purchasing',
    'installation_team', 'site_supervisor', 'accounts', 'client')),
  due_on date,
  done_at timestamptz,
  -- Stamped by the trigger below, never sent by the app.
  done_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check ((done_at is null) = (done_by is null))
);

create index site_follow_ups_site_log_id_idx on public.site_follow_ups (site_log_id);

-- Who may close a follow-up for a group. Managers (MD, Sales Director, HR & Accounts) close
-- any; an installation-team or client action is chased by the site supervisor.
create function public.can_close_follow_up(owner_group text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_manager()
    or public.has_job_role(
      case can_close_follow_up.owner_group
        when 'salesperson' then 'sales'
        when 'purchasing' then 'support'
        when 'accounts' then 'accounts'
        else 'site'
      end
    )
    or (can_close_follow_up.owner_group = 'salesperson' and public.has_job_role('bd'));
$$;

revoke execute on function public.can_close_follow_up(text) from public, anon;
grant execute on function public.can_close_follow_up(text) to authenticated;

alter table public.site_logs enable row level security;
alter table public.site_follow_ups enable row level security;

revoke all on table public.site_logs from anon, authenticated;
revoke all on table public.site_follow_ups from anon, authenticated;

grant select on table public.site_logs to authenticated;
grant insert (mof_id, visited_on, activity, notes, measurement_received, drive_link,
  handover_signed)
  on table public.site_logs to authenticated;

grant select on table public.site_follow_ups to authenticated;
grant insert (site_log_id, action, owner_group, due_on)
  on table public.site_follow_ups to authenticated;
-- Closing (or reopening) is the only change after a follow-up is added.
grant update (done_at) on table public.site_follow_ups to authenticated;

create policy "site logs: read all"
  on public.site_logs for select
  to authenticated
  using (true);

create policy "site logs: site team logs"
  on public.site_logs for insert
  to authenticated
  with check (
    (select public.has_job_role('md', 'director', 'site'))
    and supervisor_id = (select auth.uid())
  );

create policy "site follow-ups: read all"
  on public.site_follow_ups for select
  to authenticated
  using (true);

create policy "site follow-ups: site team adds"
  on public.site_follow_ups for insert
  to authenticated
  with check ((select public.has_job_role('md', 'director', 'site')));

create policy "site follow-ups: the owning group closes"
  on public.site_follow_ups for update
  to authenticated
  using ((select public.can_close_follow_up(owner_group)))
  with check ((select public.can_close_follow_up(owner_group)));

-- Closing records who and when, from the server's clock and the signed-in user.
create function public.stamp_follow_up_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.done_at is null then
    new.done_by = null;
  elsif old.done_at is null then
    new.done_at = now();
    new.done_by = auth.uid();
  else
    new.done_at = old.done_at;
    new.done_by = old.done_by;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_follow_up_done() from public, anon, authenticated;

create trigger stamp_follow_up_done
  before update on public.site_follow_ups
  for each row execute function public.stamp_follow_up_done();
