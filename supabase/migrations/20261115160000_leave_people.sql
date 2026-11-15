-- Loop 15 task 08: who the Leave page can show balances for. A balance needs the join date (the
-- first-year proration), Team leave the job role, and "Approved by" the team lead, but staff read
-- only their own profile and team_directory() has none of them. This returns the people whose
-- leave the caller already reads (same rule as the leave_requests read policy): themself, a team
-- lead's salespeople, and everyone for the MD, Sales Director and HR & Accounts. Only people
-- still here.
create function public.leave_people()
returns table (id uuid, job_role text, joined_on date, reports_to uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.job_role, p.joined_on, p.reports_to
  from public.profiles p
  where p.active
    and public.is_active()
    and (
      p.id = (select auth.uid())
      or public.has_job_role('md', 'director', 'accounts')
      or public.in_my_team(p.id)
    );
$$;

revoke execute on function public.leave_people() from public, anon;
grant execute on function public.leave_people() to authenticated;
