-- Site supervisor bookings (loop 03 task 19). Sales, the MD, the Sales Director and the BD
-- Director book a Site Supervisor for a purpose and a day; only the booked supervisor
-- confirms or declines. Everyone signed in reads them, so the installation calendar shows
-- when a supervisor is taken. Nothing is deleted: a booking that falls through is declined.

create table public.site_bookings (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references public.profiles (id),
  -- Set from the signed-in user; never part of the insert grant, so it cannot be faked.
  requested_by uuid not null default auth.uid() references public.profiles (id),
  purpose text not null check (purpose in ('site_measurement', 'site_inspection', 'handover',
    'shooting', 'meet_client', 'others')),
  project_id uuid references public.projects (id),
  -- The site when it is not a pipeline project.
  site text check (site is null or (site = btrim(site) and site <> '')),
  visit_on date not null,
  start_time time not null default '10:00',
  notes text check (notes is null or (notes = btrim(notes) and notes <> '')),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined')),
  decline_reason text check (decline_reason is null or (decline_reason = btrim(decline_reason)
    and decline_reason <> '')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check (project_id is not null or site is not null),
  check (decline_reason is null or status = 'declined')
);

create index site_bookings_supervisor_id_idx on public.site_bookings (supervisor_id);
create index site_bookings_visit_on_idx on public.site_bookings (visit_on);

alter table public.site_bookings enable row level security;

revoke all on table public.site_bookings from anon, authenticated;

grant select on table public.site_bookings to authenticated;
grant insert (supervisor_id, purpose, project_id, site, visit_on, start_time, notes)
  on table public.site_bookings to authenticated;
-- The supervisor's answer is the only change allowed after booking.
grant update (status, decline_reason) on table public.site_bookings to authenticated;

create policy "site bookings: read all"
  on public.site_bookings for select
  to authenticated
  using (true);

create policy "site bookings: sales and managers book"
  on public.site_bookings for insert
  to authenticated
  with check (
    (select public.has_job_role('md', 'director', 'bd', 'sales'))
    and requested_by = (select auth.uid())
    and status = 'requested'
  );

create policy "site bookings: the booked supervisor answers"
  on public.site_bookings for update
  to authenticated
  using (
    (select public.has_job_role('site')) and supervisor_id = (select auth.uid())
  )
  with check (
    (select public.has_job_role('site')) and supervisor_id = (select auth.uid())
  );

-- Rules RLS cannot express. Security definer so it can read the supervisor's profile.
create function public.guard_site_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.profiles where id = new.supervisor_id and job_role = 'site'
    ) then
      raise exception 'You can only book a Site Supervisor.' using errcode = '23514';
    end if;
  else
    if old.status <> 'requested' then
      raise exception 'This booking has already been answered.' using errcode = '23514';
    end if;
    if new.status = 'requested' then
      raise exception 'Confirm or decline the booking.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_site_booking
  before insert or update on public.site_bookings
  for each row execute function public.guard_site_booking();

-- Booking needs the supervisors' names, which staff cannot read from profiles.
create function public.site_supervisors()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, full_name from public.profiles where job_role = 'site';
$$;

revoke execute on function public.site_supervisors() from public, anon;
grant execute on function public.site_supervisors() to authenticated;
