-- Staff can read only their own profile, but every screen that shows an owner or
-- "passed by" needs teammates' names. Expose just id and name, not the rest.
create function public.team_directory()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, full_name from public.profiles;
$$;

revoke execute on function public.team_directory() from public, anon;
grant execute on function public.team_directory() to authenticated;
