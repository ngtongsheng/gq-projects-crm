-- Loop 18 task 01 (D1): the installer directory. Installers were free text on jobs, installer
-- POs and MOFs; each distinct name becomes one installer, and every job points at its installer.
-- Additive: the text columns keep every value. Dropping them is a later, approved step.

create table public.installers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and name <> ''),
  -- Names that differ only in case or spacing are the same person.
  name_key text not null generated always as (lower(regexp_replace(name, '\s+', ' ', 'g'))) stored
    constraint installers_name_key_unique unique,
  company text check (company is null or (company = btrim(company) and company <> '')),
  phone text check (phone is null or (phone = btrim(phone) and phone <> '')),
  phone2 text check (phone2 is null or (phone2 = btrim(phone2) and phone2 <> '')),
  -- Picked from the app's fixed list (carpet tile, vinyl, edging, ...).
  skills text[] not null default '{}',
  -- "What they can do", in their own words.
  description text check (description is null or (description = btrim(description) and description <> '')),
  area text check (area is null or (area = btrim(area) and area <> '')),
  notes text check (notes is null or (notes = btrim(notes) and notes <> '')),
  -- An installer is never deleted: one who stops working with GQ is made inactive.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

-- Backfill: one installer per distinct name. The spelling used most often wins, so "Leong" and
-- "leong" become one "Leong". "N/A" on an MOF means no installer.
insert into public.installers (name)
select distinct on (name_key) name
from (
  select regexp_replace(btrim(raw), '\s+', ' ', 'g') as name,
    lower(regexp_replace(btrim(raw), '\s+', ' ', 'g')) as name_key,
    count(*) as uses
  from (
    select installer as raw from public.jobs
    union all select installer from public.installer_pos
    union all select installer_name from public.mofs
  ) sources
  where btrim(raw) <> '' and lower(btrim(raw)) <> 'n/a'
  group by 1, 2
) spellings
order by name_key, uses desc, name;

alter table public.jobs
  add column installer_id uuid references public.installers (id);

create index jobs_installer_id_idx on public.jobs (installer_id);

update public.jobs j
set installer_id = i.id
from public.installers i
where i.name_key = lower(regexp_replace(j.installer, '\s+', ' ', 'g'));

alter table public.installers enable row level security;
revoke all on table public.installers from anon, authenticated;

grant select on table public.installers to authenticated;
grant insert (name, company, phone, phone2, skills, description, area, notes, active)
  on table public.installers to authenticated;
grant update (name, company, phone, phone2, skills, description, area, notes, active)
  on table public.installers to authenticated;

grant insert (installer_id) on table public.jobs to authenticated;
grant update (installer_id) on table public.jobs to authenticated;

-- Everyone signed in reads the directory: the job form and calendar list the installers.
create policy "installers: read all"
  on public.installers for select
  to authenticated
  using (true);

-- The demo's directory editors: the MD, Sales Director, Site Supervisors, Purchasing and
-- whoever arranges stock. HR & Accounts only reads.
create policy "installers: directory editors add"
  on public.installers for insert
  to authenticated
  with check ((select public.has_job_role('md', 'director', 'site', 'support'))
    or (select public.can_edit_stock()));

create policy "installers: directory editors edit"
  on public.installers for update
  to authenticated
  using ((select public.has_job_role('md', 'director', 'site', 'support'))
    or (select public.can_edit_stock()))
  with check ((select public.has_job_role('md', 'director', 'site', 'support'))
    or (select public.can_edit_stock()));

create policy "left people: no access"
  on public.installers as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- Unchanged from the jobs migration, except a Site Supervisor cannot change the installer_id
-- either.
create or replace function public.guard_job()
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
      or new.installer_id is distinct from old.installer_id
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

-- Keeps a job's installer text and installer_id saying the same thing while both exist.
-- Picking an installer writes their name; typing a name links that installer, adding them to
-- the directory when they are new. Runs after guard_job (triggers fire in name order).
-- On insert OLD is null, so both checks compare with null.
create function public.link_job_installer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  key text;
begin
  if new.installer_id is distinct from old.installer_id then
    new.installer := (select name from public.installers where id = new.installer_id);
  elsif new.installer is distinct from old.installer then
    if new.installer is null then
      new.installer_id := null;
    else
      key := lower(regexp_replace(new.installer, '\s+', ' ', 'g'));
      insert into public.installers (name)
      values (regexp_replace(new.installer, '\s+', ' ', 'g'))
      on conflict (name_key) do nothing;
      select id into new.installer_id from public.installers where name_key = key;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.link_job_installer() from public, anon, authenticated;

create trigger link_job_installer
  before insert or update on public.jobs
  for each row execute function public.link_job_installer();
