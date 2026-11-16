-- The MD reads every profile, but HR & Accounts (a staff role) reads only their own, so the claim
-- lists, the review page and the "not submitted yet" line came back with no name or job role for
-- anyone else and the page failed. This returns just what Claims needs about the people whose
-- claims the caller settles (the MD and HR & Accounts): name, job role, whether a site person also
-- sells, and whether they are still here. Left people stay in, because their old claims are listed.

create function public.claim_people()
returns table (id uuid, full_name text, job_role text, sells boolean, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.job_role, p.sells, p.active
  from public.profiles p
  where public.is_active()
    and public.has_job_role('md', 'accounts');
$$;

revoke execute on function public.claim_people() from public, anon;
grant execute on function public.claim_people() to authenticated;
