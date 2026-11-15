-- Loop 15 task 05: Leave (demo vLeave). A leave request is one person's application for one
-- type of leave over a run of days, decided step by step by the approvers loop 15 D4 names.
-- MC and hospitalisation carry a slip, stored in the attachments bucket under
-- leave/<request-id>/ (loop 15 D6). The company policy lives in app_settings and a per-person,
-- per-year override in leave_entitlements (D7).
--
-- Who reads: the person, the MD, the Sales Director, HR & Accounts, and a team lead for the
-- salespeople who report to them.
-- Who writes: everyone applies for their own leave and cancels it. Approvers decide through
-- decide_leave(); nobody decides their own. The person, the MD or HR & Accounts upload the slip;
-- only the MD or HR & Accounts tick "original given to HR".

-- D7: company default 14 AL and 14 MC a year; AL prorated by join month in the join year.
alter table public.app_settings
  add constraint app_settings_leave_check
  check (case
    when key not in ('leave_annual_days', 'leave_mc_days', 'leave_prorate') then true
    when key = 'leave_prorate' then jsonb_typeof(value) = 'boolean'
    when jsonb_typeof(value) <> 'number' then false
    else (value #>> '{}')::numeric between 0 and 365
      and mod((value #>> '{}')::numeric, 0.5) = 0 end);

insert into public.app_settings (key, value) values
  ('leave_annual_days', '14'),
  ('leave_mc_days', '14'),
  ('leave_prorate', 'true');

-- A person's entitlement for one year when it differs from the company default (demo
-- leaveEnt). Balances start in 2027 (D2); carried_days holds what is brought from the year
-- before. Deleting the row puts the person back on the company default.
create table public.leave_entitlements (
  profile_id uuid not null references public.profiles (id),
  year smallint not null check (year between 2027 and 2100),
  annual_days numeric(4, 1) not null
    check (annual_days between 0 and 365 and mod(annual_days, 0.5) = 0),
  carried_days numeric(4, 1) not null default 0
    check (carried_days between 0 and 365 and mod(carried_days, 0.5) = 0),
  mc_days numeric(4, 1) not null
    check (mc_days between 0 and 365 and mod(mc_days, 0.5) = 0),
  primary key (profile_id, year)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null default auth.uid() references public.profiles (id),
  -- The demo's eight types (LV_TYPES). Only annual and emergency deduct annual leave.
  leave_type text not null
    check (leave_type in (
      'annual', 'mc', 'emergency', 'hospitalisation', 'replacement', 'compassionate',
      'maternity_paternity', 'unpaid'
    )),
  starts_on date not null,
  ends_on date not null,
  half_day text check (half_day in ('am', 'pm')),
  -- Working days in the range (D5), counted by the database when the request is added.
  days numeric(4, 1) not null check (days > 0 and mod(days, 0.5) = 0),
  reason text not null default '' check (char_length(reason) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  -- The MC or hospitalisation slip; same path shape as src/lib/storage/attachment-rules.ts.
  slip_path text unique
    check (char_length(slip_path) <= 400 and starts_with(slip_path, 'leave/' || id::text || '/')),
  slip_file_name text check (char_length(slip_file_name) between 1 and 200),
  slip_content_type text
    check (slip_content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  slip_uploaded_at timestamptz,
  original_given_to_hr boolean not null default false,
  applied_at timestamptz not null default now(),
  -- Who approved, rejected or cancelled it, and when.
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text not null default '' check (char_length(decision_note) <= 500),
  check (ends_on >= starts_on and ends_on - starts_on <= 366),
  check (half_day is null or starts_on = ends_on),
  check (
    (slip_path is null) = (slip_file_name is null)
    and (slip_path is null) = (slip_content_type is null)
    and (slip_path is null) = (slip_uploaded_at is null)
  ),
  check (slip_path is null or leave_type in ('mc', 'hospitalisation')),
  check ((status = 'pending') = (decided_at is null))
);

create index leave_requests_person_id_idx on public.leave_requests (person_id, starts_on);

-- The approvers in order, fixed when the request is added (D4): a salesperson's team lead then
-- the MD; Marketing Director and Site Supervisor: Sales Director then MD; the MD: Sales
-- Director; everyone else: MD. A step names a person (the team lead) or a job role.
create table public.leave_approval_steps (
  request_id uuid not null references public.leave_requests (id) on delete cascade,
  position smallint not null check (position between 1 and 2),
  approver_id uuid references public.profiles (id),
  approver_role text check (approver_role in ('md', 'director')),
  decision text check (decision in ('approved', 'rejected')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  note text not null default '' check (char_length(note) <= 500),
  primary key (request_id, position),
  check ((approver_id is null) <> (approver_role is null)),
  check ((decision is null) = (decided_by is null) and (decision is null) = (decided_at is null))
);

create index leave_approval_steps_approver_id_idx on public.leave_approval_steps (approver_id);

-- Counts the working days and refuses overlapping leave. Security definer: the overlap check
-- must see the person's other requests whatever the caller may read.
create function public.prepare_leave_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_workday constant integer := case
    when (select job_role from public.profiles where id = new.person_id) = 'site' then 6
    else 5 end;
begin
  select count(*) * case when new.half_day is null then 1 else 0.5 end
  into new.days
  from generate_series(new.starts_on::timestamp, new.ends_on::timestamp, interval '1 day')
    as d (day)
  where extract(isodow from d.day) <= last_workday
    and not exists (select 1 from public.public_holidays h where h.day = d.day::date);

  if new.days = 0 then
    raise exception 'Those dates have no working days.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.leave_requests
    where person_id = new.person_id
      and status in ('pending', 'approved')
      and starts_on <= new.ends_on
      and ends_on >= new.starts_on
  ) then
    raise exception 'There is already leave on these dates.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.prepare_leave_request() from public, anon, authenticated;

create trigger on_leave_request_added
  before insert on public.leave_requests
  for each row execute function public.prepare_leave_request();

-- Writes the approval chain. Security definer: staff cannot read their team lead's profile.
create function public.add_leave_approval_steps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  applicant public.profiles;
  lead uuid;
begin
  select * into applicant from public.profiles where id = new.person_id;

  if applicant.job_role = 'sales' then
    select id into lead from public.profiles where id = applicant.reports_to and active;
  end if;

  if lead is not null then
    insert into public.leave_approval_steps (request_id, position, approver_id)
    values (new.id, 1, lead);
    insert into public.leave_approval_steps (request_id, position, approver_role)
    values (new.id, 2, 'md');
  elsif applicant.job_role in ('bd', 'site') then
    insert into public.leave_approval_steps (request_id, position, approver_role)
    values (new.id, 1, 'director'), (new.id, 2, 'md');
  elsif applicant.job_role = 'md' then
    insert into public.leave_approval_steps (request_id, position, approver_role)
    values (new.id, 1, 'director');
  else
    insert into public.leave_approval_steps (request_id, position, approver_role)
    values (new.id, 1, 'md');
  end if;
  return null;
end;
$$;

revoke execute on function public.add_leave_approval_steps() from public, anon, authenticated;

create trigger on_leave_request_added_steps
  after insert on public.leave_requests
  for each row execute function public.add_leave_approval_steps();

-- What the app may change on a request, which RLS cannot express per column. Approval and
-- rejection only follow the steps decide_leave() wrote. Skipped when there is no signed-in user
-- (the service role, e.g. example data scripts).
create function public.guard_leave_request_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  today constant date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if me is null then
    return new;
  end if;

  if old.status in ('rejected', 'cancelled') then
    raise exception 'This leave is closed.' using errcode = '42501';
  end if;

  if (new.slip_path, new.slip_file_name, new.slip_content_type)
    is distinct from (old.slip_path, old.slip_file_name, old.slip_content_type) then
    if not (old.person_id = me or (select public.has_job_role('md', 'accounts'))) then
      raise exception 'Only the person, the MD or HR & Accounts uploads the slip.'
        using errcode = '42501';
    end if;
    if new.slip_path is null then
      raise exception 'A slip can be replaced, not removed.' using errcode = '42501';
    end if;
    new.slip_uploaded_at = now();
  end if;

  if new.original_given_to_hr is distinct from old.original_given_to_hr
    and not (select public.has_job_role('md', 'accounts')) then
    raise exception 'Only HR & Accounts confirms the original slip.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' and old.person_id = me
      and (old.status = 'pending' or (old.status = 'approved' and old.starts_on > today)) then
      new.decided_by = me;
      new.decided_at = now();
    elsif old.status = 'pending' and new.status = 'approved'
      and not exists (
        select 1 from public.leave_approval_steps
        where request_id = old.id and decision is distinct from 'approved'
      ) then
      null;
    elsif old.status = 'pending' and new.status = 'rejected'
      and exists (
        select 1 from public.leave_approval_steps
        where request_id = old.id and decision = 'rejected'
      ) then
      null;
    else
      raise exception 'Leave cannot go from % to % here.', old.status, new.status
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_leave_request_write() from public, anon, authenticated;

create trigger on_leave_request_written
  before update on public.leave_requests
  for each row execute function public.guard_leave_request_write();

-- Approves or rejects the step waiting on the caller. An approval carries on through the next
-- steps the same person may decide, so the MD (who may decide any step) and HR & Accounts on MC
-- or hospitalisation (demo "MC checked") finish the chain in one go. A rejection ends it.
create function public.decide_leave(leave_request uuid, approve boolean, remark text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  request public.leave_requests;
  step public.leave_approval_steps;
  checks_slips boolean;
  decided integer := 0;
begin
  if not public.is_active() then
    raise exception 'Only people still here decide leave.' using errcode = '42501';
  end if;

  select * into request from public.leave_requests where id = leave_request for update;
  if not found or request.status <> 'pending' then
    raise exception 'This leave is not waiting for approval.' using errcode = '42501';
  end if;
  if request.person_id = me then
    raise exception 'Nobody approves their own leave.' using errcode = '42501';
  end if;

  checks_slips := request.leave_type in ('mc', 'hospitalisation');
  if approve and checks_slips and request.slip_path is null then
    raise exception 'Upload the slip before the leave is approved.' using errcode = '42501';
  end if;

  for step in
    select * from public.leave_approval_steps
    where request_id = leave_request and decision is null
    order by position
  loop
    exit when not (
      coalesce(step.approver_id = me, false)
      or public.has_job_role(step.approver_role)
      or public.has_job_role('md')
      or (checks_slips and public.has_job_role('accounts'))
    );
    update public.leave_approval_steps
    set decision = case when approve then 'approved' else 'rejected' end,
      decided_by = me,
      decided_at = now(),
      note = coalesce(remark, '')
    where request_id = leave_request and position = step.position;
    decided := decided + 1;
    exit when not approve;
  end loop;

  if decided = 0 then
    raise exception 'This leave is waiting for someone else.' using errcode = '42501';
  end if;

  if not approve then
    update public.leave_requests
    set status = 'rejected', decided_by = me, decided_at = now(), decision_note = coalesce(remark, '')
    where id = leave_request;
  elsif not exists (
    select 1 from public.leave_approval_steps
    where request_id = leave_request and decision is null
  ) then
    update public.leave_requests
    set status = 'approved', decided_by = me, decided_at = now(), decision_note = coalesce(remark, '')
    where id = leave_request;
  end if;
end;
$$;

revoke execute on function public.decide_leave(uuid, boolean, text) from public, anon;
grant execute on function public.decide_leave(uuid, boolean, text) to authenticated;

-- Steps are read with their request. Security definer so the steps policy can look at the
-- request without its policy getting in the way.
create function public.can_see_leave(leave_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.leave_requests r
    where r.id = leave_request
      and (
        r.person_id = (select auth.uid())
        or public.has_job_role('md', 'director', 'accounts')
        or public.in_my_team(r.person_id)
      )
  ) and public.is_active();
$$;

revoke execute on function public.can_see_leave(uuid) from public, anon;
grant execute on function public.can_see_leave(uuid) to authenticated;

alter table public.leave_entitlements enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_approval_steps enable row level security;

-- Column grants keep the person, day count, status stamps and audit columns out of the app's
-- hands. Nothing is deleted except an entitlement override going back to the default.
revoke all on table public.leave_entitlements from anon, authenticated;
grant select, delete on table public.leave_entitlements to authenticated;
grant insert (profile_id, year, annual_days, carried_days, mc_days)
  on table public.leave_entitlements to authenticated;
grant update (annual_days, carried_days, mc_days) on table public.leave_entitlements to authenticated;

revoke all on table public.leave_requests from anon, authenticated;
grant select on table public.leave_requests to authenticated;
grant insert (leave_type, starts_on, ends_on, half_day, reason)
  on table public.leave_requests to authenticated;
grant update (status, slip_path, slip_file_name, slip_content_type, original_given_to_hr)
  on table public.leave_requests to authenticated;

revoke all on table public.leave_approval_steps from anon, authenticated;
grant select on table public.leave_approval_steps to authenticated;

-- in_my_team() is true for everyone at the MD and HR & Accounts, and for a team lead's
-- salespeople.
create policy "leave entitlements: own, team lead, md, director and accounts read"
  on public.leave_entitlements for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select public.has_job_role('md', 'director', 'accounts'))
    or public.in_my_team(profile_id)
  );

create policy "leave entitlements: md and accounts add"
  on public.leave_entitlements for insert
  to authenticated
  with check ((select public.has_job_role('md', 'accounts')));

create policy "leave entitlements: md and accounts change"
  on public.leave_entitlements for update
  to authenticated
  using ((select public.has_job_role('md', 'accounts')))
  with check ((select public.has_job_role('md', 'accounts')));

create policy "leave entitlements: md and accounts remove"
  on public.leave_entitlements for delete
  to authenticated
  using ((select public.has_job_role('md', 'accounts')));

-- Row columns first: a lookup by id would not see a row being inserted, so insert ... returning
-- would fail.
create policy "leave requests: own, team lead, md, director and accounts read"
  on public.leave_requests for select
  to authenticated
  using (
    person_id = (select auth.uid())
    or (select public.has_job_role('md', 'director', 'accounts'))
    or public.in_my_team(person_id)
  );

create policy "leave requests: people apply for their own"
  on public.leave_requests for insert
  to authenticated
  with check (person_id = (select auth.uid()));

create policy "leave requests: the person, md and accounts update"
  on public.leave_requests for update
  to authenticated
  using (person_id = (select auth.uid()) or (select public.has_job_role('md', 'accounts')))
  with check (person_id = (select auth.uid()) or (select public.has_job_role('md', 'accounts')));

create policy "leave approval steps: leave readers read"
  on public.leave_approval_steps for select
  to authenticated
  using (public.can_see_leave(request_id));

create policy "left people: no access"
  on public.leave_entitlements as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.leave_requests as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.leave_approval_steps as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
