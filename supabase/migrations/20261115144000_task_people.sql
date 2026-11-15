-- Loop 15 task 03: who a task can be given to, with each person's job role (demo: PEOPLE in
-- the "Assign to" list and in Workload). Staff read only their own profile and team_directory()
-- has no job role, so the people who assign tasks, and the Sales Director and MD who see every
-- task, get id, name and job role of everyone still here.
create function public.task_people()
returns table (id uuid, full_name text, job_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, full_name, job_role
  from public.profiles
  where active
    and public.has_job_role('md', 'director', 'bd', 'support', 'marketing');
$$;

revoke execute on function public.task_people() from public, anon;
grant execute on function public.task_people() to authenticated;
