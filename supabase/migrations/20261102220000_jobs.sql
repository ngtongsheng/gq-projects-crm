-- Delivery, installation and site-measurement jobs, and delivery orders (loop 03 task 17).
-- Everyone signed in reads them (salespeople see when installers are busy). The MD,
-- Sales Director and Purchasing schedule jobs. A Site Supervisor may only change the
-- status of a job assigned to them. A delivery job carries one delivery order (DO),
-- whose full number is the MOF number plus the 4-digit Zoho running number, worked out
-- where it is shown. A job is never deleted: a wrong one is Postponed.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  job_type text not null check (job_type in ('installation', 'delivery', 'site_measurement')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'done', 'postponed')),
  scheduled_on date not null,
  -- Last day of a job that runs over several days; the same day for a one-day job.
  ends_on date not null,
  start_time time,
  installer text check (installer is null or (installer = btrim(installer) and installer <> '')),
  site_supervisor_id uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check (ends_on >= scheduled_on)
);

create index jobs_mof_id_idx on public.jobs (mof_id);
create index jobs_scheduled_on_idx on public.jobs (scheduled_on);
create index jobs_site_supervisor_id_idx on public.jobs (site_supervisor_id);

create table public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  job_id uuid not null unique references public.jobs (id),
  -- Keyed in once Zoho issues the DO; unique across all MOFs.
  running_no text unique check (running_no ~ '^[0-9]{4}$'),
  transporter text check (transporter is null or (transporter = btrim(transporter) and transporter <> '')),
  delivered_on date,
  signed_returned boolean not null default false,
  -- The last delivery for the MOF; the MOF is fully delivered once a final DO is done.
  is_final boolean not null default false,
  items text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create index delivery_orders_mof_id_idx on public.delivery_orders (mof_id);

alter table public.jobs enable row level security;
alter table public.delivery_orders enable row level security;

revoke all on table public.jobs from anon, authenticated;
revoke all on table public.delivery_orders from anon, authenticated;

grant select on table public.jobs to authenticated;
grant insert (mof_id, job_type, status, scheduled_on, ends_on, start_time,
  installer, site_supervisor_id, notes)
  on table public.jobs to authenticated;
-- The job's MOF and type are fixed once it is created. Who may change which column is
-- decided by the trigger below.
grant update (status, scheduled_on, ends_on, start_time, installer, site_supervisor_id, notes)
  on table public.jobs to authenticated;

grant select on table public.delivery_orders to authenticated;
grant insert (mof_id, job_id, running_no, transporter, delivered_on,
  signed_returned, is_final, items)
  on table public.delivery_orders to authenticated;
grant update (running_no, transporter, delivered_on, signed_returned, is_final, items)
  on table public.delivery_orders to authenticated;

create policy "jobs: read all"
  on public.jobs for select
  to authenticated
  using (true);

create policy "jobs: schedulers add"
  on public.jobs for insert
  to authenticated
  with check ((select public.has_job_role('md', 'director', 'support')));

-- Schedulers edit any job; a Site Supervisor edits only jobs assigned to them, and the
-- trigger below limits them to the status.
create policy "jobs: schedulers and the assigned supervisor edit"
  on public.jobs for update
  to authenticated
  using (
    (select public.has_job_role('md', 'director', 'support'))
    or ((select public.has_job_role('site')) and site_supervisor_id = (select auth.uid()))
  )
  with check (
    (select public.has_job_role('md', 'director', 'support'))
    or ((select public.has_job_role('site')) and site_supervisor_id = (select auth.uid()))
  );

create policy "delivery orders: read all"
  on public.delivery_orders for select
  to authenticated
  using (true);

create policy "delivery orders: schedulers add"
  on public.delivery_orders for insert
  to authenticated
  with check ((select public.has_job_role('md', 'director', 'support')));

create policy "delivery orders: schedulers edit"
  on public.delivery_orders for update
  to authenticated
  using ((select public.has_job_role('md', 'director', 'support')))
  with check ((select public.has_job_role('md', 'director', 'support')));

create function public.guard_job()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and not (select public.has_job_role('md', 'director', 'support'))
    and (new.scheduled_on is distinct from old.scheduled_on
      or new.ends_on is distinct from old.ends_on
      or new.start_time is distinct from old.start_time
      or new.installer is distinct from old.installer
      or new.site_supervisor_id is distinct from old.site_supervisor_id
      or new.notes is distinct from old.notes) then
    raise exception 'A Site Supervisor can only change the status of a job.'
      using errcode = '42501';
  end if;

  -- A delivery is only Done once Zoho has issued its DO.
  if new.status = 'done' and new.job_type = 'delivery' and not exists (
    select 1 from public.delivery_orders
    where job_id = new.id and running_no is not null
  ) then
    raise exception 'Key in the Zoho DO no. before marking the delivery Done.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger guard_job
  before insert or update on public.jobs
  for each row execute function public.guard_job();

create function public.guard_delivery_order()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  job record;
begin
  select mof_id, job_type, status into job from public.jobs where id = new.job_id;
  if job.job_type is distinct from 'delivery' or job.mof_id is distinct from new.mof_id then
    raise exception 'A DO belongs to a delivery job of the same MOF.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and (new.job_id is distinct from old.job_id
    or new.mof_id is distinct from old.mof_id) then
    raise exception 'A DO cannot move to another job.' using errcode = '23514';
  end if;

  if job.status = 'done' and new.running_no is null then
    raise exception 'Key in the Zoho DO no. before marking the delivery Done.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger guard_delivery_order
  before insert or update on public.delivery_orders
  for each row execute function public.guard_delivery_order();
