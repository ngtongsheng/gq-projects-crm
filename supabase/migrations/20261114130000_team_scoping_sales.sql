-- Loop 11 task 04 (D6): a Sales Director or Marketing Director (bd) leads a team: themself and
-- the salespeople who report to them. They read only their team's companies, customers,
-- activities and projects. The MD and HR & Accounts read everyone's. Every other role reads
-- what it read before. Mirrors the demo's myTeam/tmC/tmP/seeAct; src/lib/auth/team.ts is the
-- TS mirror for screen filters.

-- Null means everyone. Salespeople who left stay in the team so their records stay visible
-- until they are handed over. A salesperson with no lead is in no director's team.
create function public.my_team()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.job_role() in ('md', 'accounts') then null
    when public.job_role() in ('director', 'bd') then
      array[(select auth.uid())] || array(
        select id from public.profiles
        where reports_to = (select auth.uid()) and job_role = 'sales'
      )
    else array[(select auth.uid())]
  end;
$$;

create function public.in_my_team(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select team is null or coalesce(in_my_team.profile_id = any (team), false)
  from (select public.my_team() as team) as mine;
$$;

-- A customer belongs to the team of an owner, the one who passed it down, or whoever added
-- it. The policies test passed_by and created_by on the row itself: a lookup by id would not
-- see a row being inserted, so insert ... returning would fail before the owner trigger runs.
create function public.owned_by_my_team(contact uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contact_owners o
    where o.contact_id = contact and public.in_my_team(o.profile_id)
  );
$$;

-- A company belongs to the team of any of its customers.
create function public.has_my_team_customer(company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contacts c
    where c.company_id = company
      and (
        public.in_my_team(c.passed_by)
        or public.in_my_team(c.created_by)
        or public.owned_by_my_team(c.id)
      )
  );
$$;

revoke execute on function public.my_team() from public, anon;
revoke execute on function public.in_my_team(uuid) from public, anon;
revoke execute on function public.owned_by_my_team(uuid) from public, anon;
revoke execute on function public.has_my_team_customer(uuid) from public, anon;
grant execute on function public.my_team() to authenticated;
grant execute on function public.in_my_team(uuid) to authenticated;
grant execute on function public.owned_by_my_team(uuid) to authenticated;
grant execute on function public.has_my_team_customer(uuid) to authenticated;

-- Policies keep their old names because the migration guard refuses drop policy.
alter policy "companies: read all"
  on public.companies
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.in_my_team(passed_by)
    or public.in_my_team(created_by)
    or public.has_my_team_customer(id)
  );

comment on policy "companies: read all" on public.companies is
  'Despite the name: Sales and Marketing Directors read only their team''s companies (loop 11 task 04); everyone else reads all.';

alter policy "contacts: read all"
  on public.contacts
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.in_my_team(passed_by)
    or public.in_my_team(created_by)
    or public.owned_by_my_team(id)
  );

comment on policy "contacts: read all" on public.contacts is
  'Despite the name: Sales and Marketing Directors read only their team''s customers (loop 11 task 04); everyone else reads all.';

alter policy "activities: read all"
  on public.activities
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.in_my_team(owner_id)
  );

comment on policy "activities: read all" on public.activities is
  'Despite the name: Sales and Marketing Directors read only their team''s activities (loop 11 task 04); everyone else reads all.';

-- For BD and Sales my_team() is themself (or their team), so this keeps loop 07's own-only rule.
alter policy "projects: read all"
  on public.projects
  using (
    (select public.has_job_role('md', 'accounts', 'site', 'support', 'ssup'))
    or public.in_my_team(pic_id)
    or public.in_my_team(support_id)
    or public.in_my_team(passed_by)
  );

comment on policy "projects: read all" on public.projects is
  'Despite the name: MD, HR & Accounts, Site, Purchasing and Sales support read all; Sales and Marketing Directors read their team''s; everyone else reads projects where they are PIC, support or passed_by (loop 07 task 09, loop 11 tasks 03-04).';
