-- Visits, calls and meetings against a customer (loop 03 task 08). Everyone signed in
-- reads. The salesperson who owns an activity edits it; the MD and Sales Director edit
-- anyone's. HR & Accounts is read-only here, as on customers. Nothing is deleted:
-- an activity is cancelled instead.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id),
  owner_id uuid not null references public.profiles (id) default auth.uid(),
  type text not null
    check (type in ('visit', 'site_visit', 'walk_in', 'call', 'online_meeting')),
  purpose text not null check (purpose = btrim(purpose) and purpose <> ''),
  outcome text,
  starts_at timestamptz not null,
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create index activities_contact_id_idx on public.activities (contact_id);
create index activities_owner_starts_at_idx on public.activities (owner_id, starts_at);

alter table public.activities enable row level security;

-- Column grants keep id, owner_id, contact_id and the audit columns fixed after insert.
revoke all on table public.activities from anon, authenticated;
grant select on table public.activities to authenticated;
grant insert (contact_id, owner_id, type, purpose, outcome, starts_at, status)
  on table public.activities to authenticated;
grant update (type, purpose, outcome, starts_at, status)
  on table public.activities to authenticated;

create policy "activities: read all"
  on public.activities for select
  to authenticated
  using (true);

create policy "activities: log your own"
  on public.activities for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select public.has_job_role('md', 'director', 'bd', 'sales'))
  );

create policy "activities: owner, md and director edit"
  on public.activities for update
  to authenticated
  using (
    (select public.has_job_role('md', 'director'))
    or (owner_id = (select auth.uid()) and (select public.has_job_role('bd', 'sales')))
  )
  with check (
    (select public.has_job_role('md', 'director'))
    or (owner_id = (select auth.uid()) and (select public.has_job_role('bd', 'sales')))
  );

-- Latest completed activity per customer: one query feeds the health flag on the list and detail.
create view public.customer_last_activity
  with (security_invoker = true) as
  select contact_id, max(starts_at) as last_completed_at
  from public.activities
  where status = 'completed'
  group by contact_id;

revoke all on table public.customer_last_activity from anon, authenticated;
grant select on table public.customer_last_activity to authenticated;
