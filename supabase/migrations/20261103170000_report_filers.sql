-- Team Reports lists everyone who files a monthly report, including people who have not
-- started yet. Staff cannot read other profiles, so this exposes just id, name and job role of
-- the filers, and only to managers. The BD Director is listed for the MD and HR & Accounts only,
-- matching who may read their report.
create function public.report_filers()
returns table (id uuid, full_name text, job_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, full_name, job_role
  from public.profiles
  where public.is_manager()
    and (
      job_role in ('sales', 'site')
      or (job_role = 'bd' and public.has_job_role('md', 'accounts'))
    );
$$;

revoke execute on function public.report_filers() from public, anon;
grant execute on function public.report_filers() to authenticated;
