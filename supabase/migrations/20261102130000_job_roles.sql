-- Job role and per-person settings on profiles. `role` (admin | staff) still decides
-- who manages people; `job_role` decides what someone can do in the CRM (loop 03 D2).

alter table public.profiles
  add column job_role text not null default 'sales'
    check (job_role in ('md', 'director', 'bd', 'sales', 'accounts', 'site', 'support')),
  add column arranges_stock boolean not null default false,
  add column commission_mode text not null default 'standard'
    check (commission_mode in ('standard', 'excluded', 'flat_pass_down')),
  add column yearly_target numeric(14,2) check (yearly_target >= 0);

-- The "profiles: admins update" policy still limits who may write these.
grant update (job_role, arranges_stock, commission_mode, yearly_target)
  on table public.profiles to authenticated;

-- Helpers for later policies. Security definer so policies on any table can read
-- the caller's profile without recursing into profiles RLS.
create function public.job_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select job_role from public.profiles where id = (select auth.uid());
$$;

create function public.has_job_role(variadic job_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and job_role = any (job_roles)
  );
$$;

create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_job_role('md', 'director', 'accounts');
$$;

revoke execute on function public.job_role() from public, anon;
revoke execute on function public.has_job_role(text[]) from public, anon;
revoke execute on function public.is_manager() from public, anon;
grant execute on function public.job_role() to authenticated;
grant execute on function public.has_job_role(text[]) to authenticated;
grant execute on function public.is_manager() to authenticated;
