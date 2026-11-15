-- Loop 16 task 05 (D3): a sales target and a visit target per person per year. A person's
-- effective sales target for a year is their own row's, else their grade's annual target.
-- profiles.yearly_target stays, kept equal to the current year's effective target by the
-- triggers below, so loop 14 Performance reads the same column as before.
--
-- Who reads and writes: the MD, directors and HR & Accounts set targets; a person reads
-- their own and a team lead reads their team's (my_team). The grade fallback is resolved
-- inside the database, so the grade table stays hidden from everyone else (D1).

create table public.yearly_targets (
  profile_id uuid not null references public.profiles (id),
  year smallint not null check (year between 2000 and 2100),
  -- Empty falls back to the grade's annual target.
  sales_target numeric(14, 2) check (sales_target >= 0),
  visit_target integer check (visit_target >= 0),
  primary key (profile_id, year)
);

-- The year the business is in (Malaysia time).
create function public.current_target_year()
returns smallint
language sql
stable
set search_path = ''
as $$
  select extract(year from now() at time zone 'Asia/Kuala_Lumpur')::smallint;
$$;

create function public.effective_sales_target(person uuid, target_year smallint)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select t.sales_target from public.yearly_targets t
      where t.profile_id = person and t.year = target_year),
    (select g.annual_target from public.staff_hr_records r
      join public.sales_grades g on g.grade = r.grade
      where r.profile_id = person)
  );
$$;

create function public.sync_yearly_target(person uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
  set yearly_target = public.effective_sales_target(person, public.current_target_year())
  where p.id = person
    and p.yearly_target is distinct from
      public.effective_sales_target(person, public.current_target_year());
$$;

create function public.sync_yearly_target_from_targets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_yearly_target(old.profile_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_yearly_target(new.profile_id);
  end if;
  return null;
end;
$$;

create trigger sync_yearly_target
  after insert or update or delete on public.yearly_targets
  for each row execute function public.sync_yearly_target_from_targets();

-- A grade change moves the target of anyone without their own row for the year.
create trigger sync_yearly_target
  after insert or update of profile_id, grade or delete on public.staff_hr_records
  for each row execute function public.sync_yearly_target_from_targets();

create function public.sync_yearly_target_from_grade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_yearly_target(r.profile_id)
  from public.staff_hr_records r
  where r.grade = new.grade;
  return null;
end;
$$;

create trigger sync_yearly_target
  after update of annual_target on public.sales_grades
  for each row execute function public.sync_yearly_target_from_grade();

revoke execute on function public.current_target_year() from public, anon, authenticated;
revoke execute on function public.effective_sales_target(uuid, smallint)
  from public, anon, authenticated;
revoke execute on function public.sync_yearly_target(uuid) from public, anon, authenticated;
revoke execute on function public.sync_yearly_target_from_targets()
  from public, anon, authenticated;
revoke execute on function public.sync_yearly_target_from_grade()
  from public, anon, authenticated;

-- Backfill: everyone's current target becomes their row for this year, so no number moves.
-- People without a target get no row and keep none until a target or grade is set.
insert into public.yearly_targets (profile_id, year, sales_target)
select id, public.current_target_year(), yearly_target
from public.profiles
where yearly_target is not null;

alter table public.yearly_targets enable row level security;

create policy "yearly targets: managers, themselves and their team lead read"
  on public.yearly_targets for select to authenticated
  using (
    (select public.has_job_role('md', 'director', 'accounts'))
    or public.in_my_team(profile_id)
  );

create policy "yearly targets: md, directors and accounts add"
  on public.yearly_targets for insert to authenticated
  with check ((select public.has_job_role('md', 'director', 'accounts')));

create policy "yearly targets: md, directors and accounts change"
  on public.yearly_targets for update to authenticated
  using ((select public.has_job_role('md', 'director', 'accounts')))
  with check ((select public.has_job_role('md', 'director', 'accounts')));

create policy "yearly targets: md, directors and accounts remove"
  on public.yearly_targets for delete to authenticated
  using ((select public.has_job_role('md', 'director', 'accounts')));

-- Same rule as every table (loop 11): a person who has left reads and writes nothing.
create policy "left people: no access"
  on public.yearly_targets as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
