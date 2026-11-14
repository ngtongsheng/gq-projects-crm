-- Loop 12 task 04: the data behind the demo's Sales Calendar. Outcomes on activities, colleagues
-- invited to an activity, and the weekly report each salesperson submits to their team lead.
-- The deadline for both is one app_settings row (D6): Friday 18:00 Malaysia time by default.

-- When outcomes and weekly reports are due: ISO weekday (Friday = 5) and time in Malaysia.
-- Its editing screen comes with Tools & Forms (D6); the MD changes it through app_settings.
alter table public.app_settings
  add constraint app_settings_weekly_report_due_check
  check (case
    when key <> 'weekly_report_due' then true
    when jsonb_typeof(value) <> 'object'
      or jsonb_typeof(value -> 'weekday') <> 'number'
      or jsonb_typeof(value -> 'time') <> 'string' then false
    else (value ->> 'weekday') in ('1', '2', '3', '4', '5', '6', '7')
      and (value ->> 'time') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' end);

insert into public.app_settings (key, value) values
  ('weekly_report_due', '{"weekday": 5, "time": "18:00"}');

-- The deadline for the week holding this day, as in the demo's wkDueTs: that week's Friday
-- (or the set weekday) at the set time, Malaysia time. Falls back to Friday 18:00.
create function public.weekly_report_due_at(day date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (
    day - (extract(isodow from day)::int - 1)
    + (coalesce((s.value ->> 'weekday')::int, 5) - 1)
    + coalesce((s.value ->> 'time')::time, time '18:00')
  ) at time zone 'Asia/Kuala_Lumpur'
  from (select 1) as one
  left join public.app_settings s on s.key = 'weekly_report_due';
$$;

revoke execute on function public.weekly_report_due_at(date) from public, anon;
grant execute on function public.weekly_report_due_at(date) to authenticated;

-- Outcome fields. The existing free-text `outcome` is what the demo calls "what did you learn"
-- (its `outcome` field holds the same text), so it stays as the learnings and keeps every value.
alter table public.activities
  add column result text
    check (result in ('introduced', 'presented', 'sample_requested', 'quotation_requested',
      'specified', 'order_confirmed', 'follow_up_later', 'not_interested')),
  -- The project lead created from this visit, if any. Projects are not deleted in the app;
  -- set null only lets the example data reset clear its projects.
  add column lead_project_id uuid references public.projects (id) on delete set null,
  -- Set by the guard below when the activity is completed; never trusted from the client.
  add column logged_at timestamptz,
  add column late_logged boolean not null default false;

comment on column public.activities.outcome is
  'What the salesperson learned about the company (the demo''s outcome / learnings text).';

-- D3: visits completed before go-live count as logged on time, so weekly outcomes start clean.
update public.activities
  set logged_at = starts_at
  where status = 'completed';

alter table public.activities
  add constraint activities_logged_when_completed
    check ((status = 'completed') = (logged_at is not null)),
  add constraint activities_late_only_when_logged
    check (not late_logged or logged_at is not null),
  add constraint activities_result_only_when_logged
    check (result is null or logged_at is not null);

create index activities_lead_project_id_idx on public.activities (lead_project_id);

grant insert (result, lead_project_id) on table public.activities to authenticated;
grant update (result, lead_project_id) on table public.activities to authenticated;

-- Completing an activity stamps when its outcome was logged and whether that was after the
-- deadline of the activity's own week (demo applyOut: loggedTs > wkDueTs(a.date)). The app
-- sends result, outcome and lead; logged_at and late_logged are only ever set here.
create function public.stamp_activity_logged()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed'
    and (tg_op = 'INSERT' or old.status <> 'completed') then
    -- Example data and imports (no signed-in user) count as logged on the day, as D3 does.
    if (select auth.uid()) is null then
      new.logged_at = coalesce(new.logged_at, new.starts_at);
      return new;
    end if;
    new.logged_at = now();
    new.late_logged = now() > public.weekly_report_due_at(
      (new.starts_at at time zone 'Asia/Kuala_Lumpur')::date);
  elsif tg_op = 'UPDATE' then
    new.logged_at = old.logged_at;
    new.late_logged = old.late_logged;
  else
    new.logged_at = null;
    new.late_logged = false;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_activity_logged() from public, anon, authenticated;

create trigger stamp_activity_logged
  before insert or update on public.activities
  for each row execute function public.stamp_activity_logged();

-- Colleagues invited to an activity (demo inv[]): pending until they accept or decline.
create table public.activity_invitees (
  -- Activities are not deleted in the app (they are cancelled); the cascade only lets the
  -- example data reset clear activities the team added under example customers.
  activity_id uuid not null references public.activities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  invited_at timestamptz not null default now(),
  invited_by uuid references public.profiles (id) default auth.uid(),
  answered_at timestamptz,
  primary key (activity_id, profile_id),
  check ((status = 'pending') = (answered_at is null))
);

create index activity_invitees_profile_id_idx on public.activity_invitees (profile_id);

-- Security definer so the activities and invitees policies can test each other without looping.
create function public.is_invited_to(activity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.activity_invitees i
    where i.activity_id = activity and i.profile_id = (select auth.uid())
  );
$$;

-- Who may invite to, and re-invite on, an activity: whoever may edit it (the activities
-- update policy: the MD and Sales Director any, BD and Sales their own).
create function public.can_edit_activity(activity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_job_role('md', 'director')
    or exists (
      select 1 from public.activities a
      where a.id = activity
        and a.owner_id = (select auth.uid())
        and public.has_job_role('bd', 'sales')
    );
$$;

revoke execute on function public.is_invited_to(uuid) from public, anon;
revoke execute on function public.can_edit_activity(uuid) from public, anon;
grant execute on function public.is_invited_to(uuid) to authenticated;
grant execute on function public.can_edit_activity(uuid) to authenticated;

-- RLS decides who; this decides what each may do. The invitee accepts or declines; whoever
-- invited may only send it again (back to pending). The owner is never their own invitee.
-- A colleague can be marked accepted at once only on a visit already recorded as done.
-- Skipped without a signed-in user (example data scripts).
create function public.guard_activity_invitee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.activities a
      where a.id = new.activity_id and a.owner_id = new.profile_id
    ) then
      raise exception 'The salesperson on the activity can''t be invited to it.'
        using errcode = 'check_violation';
    end if;
    new.invited_by = (select auth.uid());
    new.invited_at = now();
    if new.status = 'declined' or (new.status = 'accepted' and not exists (
      select 1 from public.activities a
      where a.id = new.activity_id and a.status = 'completed'
    )) then
      raise exception 'A new invitation waits for the colleague''s answer.'
        using errcode = '42501';
    end if;
    new.answered_at = case when new.status = 'pending' then null else now() end;
    return new;
  end if;

  if new.status = old.status then
    return old;
  end if;
  if old.profile_id = (select auth.uid()) then
    if new.status = 'pending' then
      raise exception 'Accept or decline the invitation.' using errcode = '42501';
    end if;
    new.answered_at = now();
  else
    if new.status <> 'pending' then
      raise exception 'Only the invited colleague can answer an invitation.'
        using errcode = '42501';
    end if;
    new.invited_by = (select auth.uid());
    new.invited_at = now();
    new.answered_at = null;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_activity_invitee() from public, anon, authenticated;

create trigger guard_activity_invitee
  before insert or update on public.activity_invitees
  for each row execute function public.guard_activity_invitee();

alter table public.activity_invitees enable row level security;

revoke all on table public.activity_invitees from anon, authenticated;
grant select on table public.activity_invitees to authenticated;
grant insert (activity_id, profile_id, status) on table public.activity_invitees to authenticated;
grant update (status) on table public.activity_invitees to authenticated;

-- Everyone who reads the activity sees who is invited, and invitees see their own invitations.
create policy "activity invitees: read with the activity"
  on public.activity_invitees for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.activities a where a.id = activity_id)
  );

create policy "activity invitees: activity editors invite"
  on public.activity_invitees for insert
  to authenticated
  with check (public.can_edit_activity(activity_id));

create policy "activity invitees: invitee answers, editor re-invites"
  on public.activity_invitees for update
  to authenticated
  using (profile_id = (select auth.uid()) or public.can_edit_activity(activity_id))
  with check (profile_id = (select auth.uid()) or public.can_edit_activity(activity_id));

-- An invited colleague reads the activity even outside their team.
alter policy "activities: read all"
  on public.activities
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.in_my_team(owner_id)
    or public.is_invited_to(id)
  );

comment on policy "activities: read all" on public.activities is
  'Despite the name: Sales and Marketing Directors read only their team''s activities (loop 11 task 04) and those they are invited to (loop 12 task 04); everyone else reads all.';

-- Who may review a salesperson's weekly report: the MD, or the Sales or Marketing Director
-- whose team they are in (demo reviewBar: md or leadOf(who) === me). Never the writer.
create function public.can_review_weekly_report(writer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select writer <> (select auth.uid())
    and (
      public.has_job_role('md')
      or (public.has_job_role('director', 'bd') and public.in_my_team(writer))
    );
$$;

revoke execute on function public.can_review_weekly_report(uuid) from public, anon;
grant execute on function public.can_review_weekly_report(uuid) to authenticated;

-- One report per salesperson per Mon-Sun week, submitted once, then reviewed (demo wreports).
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  -- Set by the guard below from the signed-in person; never trusted from the client.
  profile_id uuid not null default auth.uid() references public.profiles (id),
  -- The Monday the week starts on.
  week date not null check (extract(isodow from week) = 1),
  note text check (note is null or (note = btrim(note) and note <> '')),
  status text not null default 'submitted' check (status in ('submitted', 'reviewed')),
  submitted_at timestamptz not null default now(),
  -- Submitted after the week's deadline (weekly_report_due_at).
  late boolean not null default false,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text check (review_note is null or (review_note = btrim(review_note) and review_note <> '')),
  created_at timestamptz not null default now(),
  unique (profile_id, week),
  check ((status = 'reviewed') = (reviewed_at is not null))
);

-- Submit stamps the writer, time and lateness; review stamps the reviewer. Nothing else changes.
-- Skipped without a signed-in user (example data scripts).
create function public.guard_weekly_report_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.week > date_trunc('week', now() at time zone 'Asia/Kuala_Lumpur')::date then
      raise exception 'You cannot submit a report for a week that has not started.'
        using errcode = '22023';
    end if;
    new.profile_id = (select auth.uid());
    new.status = 'submitted';
    new.submitted_at = now();
    new.late = now() > public.weekly_report_due_at(new.week);
    new.reviewed_by = null;
    new.reviewed_at = null;
    new.review_note = null;
    return new;
  end if;

  if old.status <> 'submitted' or new.status <> 'reviewed' then
    raise exception 'A submitted report can only be marked reviewed.' using errcode = '42501';
  end if;
  new.profile_id = old.profile_id;
  new.week = old.week;
  new.note = old.note;
  new.submitted_at = old.submitted_at;
  new.late = old.late;
  new.reviewed_by = (select auth.uid());
  new.reviewed_at = now();
  return new;
end;
$$;

revoke execute on function public.guard_weekly_report_write() from public, anon, authenticated;

create trigger guard_weekly_report_write
  before insert or update on public.weekly_reports
  for each row execute function public.guard_weekly_report_write();

alter table public.weekly_reports enable row level security;

revoke all on table public.weekly_reports from anon, authenticated;
grant select on table public.weekly_reports to authenticated;
grant insert (week, note) on table public.weekly_reports to authenticated;
grant update (status, review_note) on table public.weekly_reports to authenticated;

-- The writer, the MD and HR & Accounts (everyone's), and a director their own team's.
create policy "weekly reports: own, and team leads read"
  on public.weekly_reports for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or ((select public.has_job_role('md', 'accounts', 'director', 'bd')) and public.in_my_team(profile_id))
  );

create policy "weekly reports: salespeople submit their own"
  on public.weekly_reports for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select public.has_job_role('sales', 'bd'))
  );

create policy "weekly reports: md and team lead review"
  on public.weekly_reports for update
  to authenticated
  using (status = 'submitted' and public.can_review_weekly_report(profile_id))
  with check (public.can_review_weekly_report(profile_id));
