-- Loop 11 task 13: public holidays, left out of workday and pace maths. One row per day. The
-- Leave screen (a later loop) lets the MD and HR & Accounts add and remove them; until then the
-- demo's own list is the seed.
create table public.public_holidays (
  day date primary key,
  name text not null check (length(btrim(name)) > 0)
);

alter table public.public_holidays enable row level security;

revoke all on table public.public_holidays from anon, authenticated;
grant select, insert, update, delete on table public.public_holidays to authenticated;

-- Everyone signed in reads the list: every dashboard's pace needs it.
create policy "public holidays: signed-in people read"
  on public.public_holidays for select
  to authenticated
  using (true);

create policy "public holidays: md and accounts add"
  on public.public_holidays for insert
  to authenticated
  with check ((select public.has_job_role('md', 'accounts')));

create policy "public holidays: md and accounts edit"
  on public.public_holidays for update
  to authenticated
  using ((select public.has_job_role('md', 'accounts')))
  with check ((select public.has_job_role('md', 'accounts')));

create policy "public holidays: md and accounts remove"
  on public.public_holidays for delete
  to authenticated
  using ((select public.has_job_role('md', 'accounts')));

create policy "left people: no access"
  on public.public_holidays
  as restrictive
  for all
  to authenticated
  using ((select public.is_active()))
  with check ((select public.is_active()));

-- The demo seeds Christmas Day of the current year; the next year is added so the calendar is
-- not empty after New Year.
insert into public.public_holidays (day, name) values
  ('2026-12-25', 'Christmas Day'),
  ('2027-12-25', 'Christmas Day');
