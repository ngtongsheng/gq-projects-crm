-- Loop 11 task 03: the demo's ten job roles and the person fields later loops need.
-- Additive: the job role check only widens, and every new column has a safe default, so
-- every stored profile keeps its values.

-- New job roles: Sales support (ssup), Marketing Executive (marketing), Designer (designer).
-- Replaced in one statement under the same name, so no row is ever unchecked.
alter table public.profiles
  drop constraint profiles_job_role_check,
  add constraint profiles_job_role_check
    check (job_role in (
      'md', 'director', 'bd', 'sales', 'accounts', 'site', 'support',
      'ssup', 'marketing', 'designer'
    ));

alter table public.profiles
  add column title text check (char_length(title) <= 120),
  add column joined_on date,
  add column active boolean not null default true,
  add column left_on date,
  add column left_reason text check (char_length(left_reason) <= 500),
  -- A salesperson's team lead: a Sales Director or Marketing Director (checked below).
  add column reports_to uuid references public.profiles (id) on delete set null,
  -- A Site Supervisor who also sells.
  add column sells boolean not null default false,
  add column sees_margin boolean not null default false,
  -- E.164 digits without the plus, e.g. 60123456789.
  add column whatsapp text check (whatsapp ~ '^[0-9]{8,15}$'),
  add column language text not null default 'en' check (language in ('en', 'bm', 'zh')),
  add constraint profiles_reports_to_not_self check (reports_to <> id);

-- The "profiles: admins update" policy still limits who may write these.
grant update (
  title, joined_on, active, left_on, left_reason, reports_to, sells, sees_margin,
  whatsapp, language
) on table public.profiles to authenticated;

-- A check constraint cannot look at another row. Security definer so the check sees the
-- lead's job role whoever writes.
create function public.check_reports_to()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reports_to is not null and not exists (
    select 1 from public.profiles
    where id = new.reports_to and job_role in ('director', 'bd')
  ) then
    raise exception 'A person can only report to a Sales Director or Marketing Director.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_reports_to() from public, anon, authenticated;

create trigger check_reports_to
  before insert or update of reports_to on public.profiles
  for each row execute function public.check_reports_to();

-- A person who has left (active = false) has no role: every helper policies call says no.
create function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active
  );
$$;

revoke execute on function public.is_active() from public, anon;
grant execute on function public.is_active() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and active
  );
$$;

create or replace function public.job_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select job_role from public.profiles where id = (select auth.uid()) and active;
$$;

create or replace function public.has_job_role(variadic job_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active and job_role = any (job_roles)
  );
$$;

-- Most read policies are `using (true)`, so the helpers alone do not lock a left person out.
-- A restrictive policy is ANDed with every other policy: on every table with row-level
-- security a left person reads and writes nothing. New tables need the same policy.
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and c.relname <> 'profiles'
  loop
    execute format(
      'create policy "left people: no access" on public.%I as restrictive for all '
      'to authenticated using ((select public.is_active())) '
      'with check ((select public.is_active()))',
      t.relname
    );
  end loop;
end;
$$;

-- On profiles a left person still reads their own row, so the app can see they have left and
-- sign them out instead of failing to load their profile.
create policy "profiles: left people read only themselves"
  on public.profiles
  as restrictive
  for all
  to authenticated
  using (id = (select auth.uid()) or (select public.is_active()))
  with check ((select public.is_active()));

-- Sales support reads every project, like Purchasing, for Delivery & Installation and Site
-- Work. Marketing and Designer read none (they are never PIC, support or passed_by).
alter policy "projects: read all"
  on public.projects
  using (
    (select public.has_job_role('md', 'director', 'accounts', 'site', 'support', 'ssup'))
    or (select auth.uid()) in (pic_id, support_id, passed_by)
  );

comment on policy "projects: read all" on public.projects is
  'Despite the name: managers, HR & Accounts, Site, Purchasing and Sales support read all; BD and Sales read only projects where they are PIC, support or passed_by (loop 07 task 09, loop 11 task 03).';

-- Adding customers was "anyone but HR & Accounts". Keep exactly today's roles so the new
-- roles, which have no Customers page, cannot add companies or contacts.
alter policy "companies: add unless read-only"
  on public.companies
  with check ((select public.has_job_role('md', 'director', 'bd', 'sales', 'site', 'support')));

alter policy "contacts: add unless read-only"
  on public.contacts
  with check ((select public.has_job_role('md', 'director', 'bd', 'sales', 'site', 'support')));
