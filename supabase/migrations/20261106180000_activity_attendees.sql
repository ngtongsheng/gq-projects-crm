-- A salesperson can invite colleagues to an activity, e.g. a senior to a big presentation. The
-- activity stays one row owned by whoever logged it; the people invited are listed here, see it on
-- their own calendar and count it as theirs. Only the owner, the MD or the Sales Director change
-- who is invited, and only salespeople and directors can be invited.

create table public.activity_attendees (
  activity_id uuid not null references public.activities (id),
  profile_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  primary key (activity_id, profile_id)
);

create index activity_attendees_profile_id_idx on public.activity_attendees (profile_id);

-- Everyone with a login who can be invited: the MD, Sales Director, BD Director and salespeople.
-- Staff cannot read profiles, so the list goes through this function, like site_supervisors().
create function public.sales_colleagues()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.job_role in ('md', 'director', 'bd', 'sales')
  order by p.full_name;
$$;

revoke execute on function public.sales_colleagues() from public, anon;
grant execute on function public.sales_colleagues() to authenticated;

-- Whether a person may be invited. Security definer so the check does not depend on who may read
-- profiles.
create function public.can_be_invited(person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = can_be_invited.person
      and p.job_role in ('md', 'director', 'bd', 'sales')
  );
$$;

revoke execute on function public.can_be_invited(uuid) from public, anon;
grant execute on function public.can_be_invited(uuid) to authenticated;

alter table public.activity_attendees enable row level security;

revoke all on table public.activity_attendees from anon, authenticated;
grant select, delete on table public.activity_attendees to authenticated;
grant insert (activity_id, profile_id) on table public.activity_attendees to authenticated;

create policy "activity attendees: read all"
  on public.activity_attendees for select
  to authenticated
  using (true);

create policy "activity attendees: the owner, md and director invite"
  on public.activity_attendees for insert
  to authenticated
  with check (
    public.can_be_invited(profile_id)
    and not exists (
      select 1 from public.activities a
      where a.id = activity_id and a.owner_id = profile_id
    )
    and (
      (select public.has_job_role('md', 'director'))
      or exists (
        select 1 from public.activities a
        where a.id = activity_id and a.owner_id = (select auth.uid())
      )
    )
  );

create policy "activity attendees: the owner, md and director uninvite"
  on public.activity_attendees for delete
  to authenticated
  using (
    (select public.has_job_role('md', 'director'))
    or exists (
      select 1 from public.activities a
      where a.id = activity_id and a.owner_id = (select auth.uid())
    )
  );
