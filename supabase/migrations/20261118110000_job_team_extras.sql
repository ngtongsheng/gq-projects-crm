-- Loop 18 task 03: job form extras from the demo. A job can be "Supervisor only" (no installer
-- crew, only the supervisor attends), and the person in charge can be a salesperson as well as
-- a Site Supervisor (site_supervisor_id already holds any person, so that needs no column).
-- Additive: existing jobs keep every value.

alter table public.jobs
  add column supervisor_only boolean not null default false,
  add constraint jobs_supervisor_only_has_no_installer
    check (not (supervisor_only and (installer is not null or installer_id is not null)));

grant insert (supervisor_only) on table public.jobs to authenticated;
grant update (supervisor_only) on table public.jobs to authenticated;

-- Unchanged from the installers migration, except a Site Supervisor cannot change
-- supervisor_only either.
create or replace function public.guard_job()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and not (select public.has_job_role('md', 'director', 'support'))
    and (new.scheduled_on is distinct from old.scheduled_on
      or new.ends_on is distinct from old.ends_on
      or new.start_time is distinct from old.start_time
      or new.installer is distinct from old.installer
      or new.installer_id is distinct from old.installer_id
      or new.supervisor_only is distinct from old.supervisor_only
      or new.site_supervisor_id is distinct from old.site_supervisor_id
      or new.notes is distinct from old.notes) then
    raise exception 'A Site Supervisor can only change the status of a job.'
      using errcode = '42501';
  end if;

  -- A delivery is only Done once Zoho has issued its DO.
  if new.status = 'done' and new.job_type = 'delivery' and not exists (
    select 1 from public.delivery_orders
    where job_id = new.id and running_no is not null
  ) then
    raise exception 'Key in the Zoho DO no. before marking the delivery Done.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- The "Salesperson in charge" choices on the job form. Staff cannot read profiles, so this
-- goes through a function, like site_supervisors().
create function public.salespeople()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, full_name from public.profiles
  where job_role in ('director', 'bd', 'sales') and active;
$$;

revoke execute on function public.salespeople() from public, anon;
grant execute on function public.salespeople() to authenticated;
