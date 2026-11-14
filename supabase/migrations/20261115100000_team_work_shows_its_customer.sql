-- Loop 11 task 15: a Sales or Marketing Director saw a team project or activity but not its
-- customer (the team rule on customers looks at owners and who added them, not at the work), so
-- screens that show "project at company" crashed on the missing customer. Customers and companies
-- the team has a project or activity on are now readable too.

create function public.has_my_team_work(contact uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.contact_id = contact
      and (public.in_my_team(p.pic_id) or public.in_my_team(p.support_id))
  ) or exists (
    select 1 from public.activities a
    where a.contact_id = contact and public.in_my_team(a.owner_id)
  );
$$;

create function public.has_my_team_work_at(company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contacts c
    where c.company_id = company and public.has_my_team_work(c.id)
  );
$$;

revoke execute on function public.has_my_team_work(uuid) from public, anon;
revoke execute on function public.has_my_team_work_at(uuid) from public, anon;
grant execute on function public.has_my_team_work(uuid) to authenticated;
grant execute on function public.has_my_team_work_at(uuid) to authenticated;

alter policy "companies: read all"
  on public.companies
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.in_my_team(passed_by)
    or public.in_my_team(created_by)
    or public.has_my_team_customer(id)
    or public.has_my_team_work_at(id)
  );

alter policy "contacts: read all"
  on public.contacts
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.in_my_team(passed_by)
    or public.in_my_team(created_by)
    or public.owned_by_my_team(id)
    or public.has_my_team_work(id)
  );

comment on policy "companies: read all" on public.companies is
  'Despite the name: Sales and Marketing Directors read their team''s companies and those their team has work at (loop 11 tasks 04, 15); everyone else reads all.';
comment on policy "contacts: read all" on public.contacts is
  'Despite the name: Sales and Marketing Directors read their team''s customers and those their team has work on (loop 11 tasks 04, 15); everyone else reads all.';
