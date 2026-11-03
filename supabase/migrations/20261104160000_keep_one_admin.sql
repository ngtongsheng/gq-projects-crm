-- There must always be at least one admin, or nobody can open People again. The app checked
-- this by reading the admins and then writing, so two admins demoting each other at once, or a
-- direct API call, could leave none. The advisory lock makes role changes queue up so each one
-- counts the admins after the previous change. Security definer: it counts every admin, not
-- only the rows the caller may read.

create function public.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'admin' or new.role = 'admin' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('public.profiles admins'));
  if not exists (
    select 1 from public.profiles where role = 'admin' and id <> old.id
  ) then
    raise exception 'There must be at least one admin.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.keep_one_admin() from public, anon, authenticated;

create trigger keep_one_admin
  before update of role on public.profiles
  for each row execute function public.keep_one_admin();
