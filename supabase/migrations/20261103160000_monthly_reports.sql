-- Monthly reports (loop 03 task 27). Salespeople, the BD Director and Site Supervisors each
-- file one report a month, prefilled with their figures. They save drafts and submit; the
-- figures are frozen in `stats` at submit. The MD or Sales Director reviews sales and site
-- reports; only the MD reviews the BD Director's. Due and late are worked out on read (D8).

-- When reports are due on the first Monday of the next month (Malaysia time), and the monthly
-- targets the reports measure against. The MD changes them (app_settings policies).
alter table public.app_settings
  add constraint app_settings_report_due_time_check
  check (case
    when key <> 'report_due_time' then true
    when jsonb_typeof(value) <> 'string' then false
    else (value #>> '{}') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' end);

alter table public.app_settings
  add constraint app_settings_report_targets_check
  check (key <> 'report_targets' or jsonb_typeof(value) = 'object');

insert into public.app_settings (key, value) values
  ('report_due_time', '"09:00"'),
  ('report_targets', '{"salesVisits": 50, "siteVisits": 50, "shootings": 5, "handovers": 5}');

create table public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  -- Set by the guard below from the signed-in person; never trusted from the client.
  profile_id uuid not null default auth.uid() references public.profiles (id),
  month date not null check (extract(day from month) = 1),
  kind text not null check (kind in ('sales', 'bd', 'site')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  -- The figures as they were when submitted; null while a draft.
  stats jsonb check (stats is null or jsonb_typeof(stats) = 'object'),
  -- [{ "company": "...", "achievement": "..." }]
  highlights jsonb not null default '[]' check (jsonb_typeof(highlights) = 'array'),
  next_month_plan text check (next_month_plan is null or (next_month_plan = btrim(next_month_plan) and next_month_plan <> '')),
  support_needed text check (support_needed is null or (support_needed = btrim(support_needed) and support_needed <> '')),
  -- BD only: confirms every pass-down this month is recorded in Projects.
  pass_downs_confirmed boolean not null default false,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text check (review_note is null or (review_note = btrim(review_note) and review_note <> '')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  unique (profile_id, month),
  check ((status = 'draft') = (submitted_at is null)),
  check ((status = 'reviewed') = (reviewed_at is not null))
);

-- Who may review a report of this kind. Mirrors canReviewReport in report-stats.ts.
create function public.can_review_monthly_report(report_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case report_kind
    when 'bd' then public.has_job_role('md')
    else public.has_job_role('md', 'director')
  end;
$$;

revoke execute on function public.can_review_monthly_report(text) from public, anon;
grant execute on function public.can_review_monthly_report(text) to authenticated;

-- The steps a report may take (draft -> submitted -> reviewed) and the clocks. RLS decides who;
-- this decides what each step may change. Skipped without a signed-in user (example data scripts).
create function public.guard_monthly_report_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.profile_id = (select auth.uid());
    new.kind = case public.job_role()
      when 'sales' then 'sales'
      when 'bd' then 'bd'
      when 'site' then 'site'
    end;
    if new.kind is null then
      raise exception 'Only salespeople, the BD Director and Site Supervisors file monthly reports.'
        using errcode = '42501';
    end if;
    if new.month > date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur')::date then
      raise exception 'You cannot file a report for a month that has not started.'
        using errcode = '22023';
    end if;
    if new.status = 'reviewed' then
      raise exception 'Submit the report before it is reviewed.' using errcode = '42501';
    end if;
  elsif old.status = 'draft' then
    new.profile_id = old.profile_id;
    new.month = old.month;
    new.kind = old.kind;
    if new.status = 'reviewed' then
      raise exception 'Submit the report before it is reviewed.' using errcode = '42501';
    end if;
  elsif old.status = 'submitted' then
    if new.status <> 'reviewed'
      or new.month is distinct from old.month
      or new.stats is distinct from old.stats
      or new.highlights is distinct from old.highlights
      or new.next_month_plan is distinct from old.next_month_plan
      or new.support_needed is distinct from old.support_needed
      or new.pass_downs_confirmed is distinct from old.pass_downs_confirmed then
      raise exception 'A submitted report can only be marked reviewed.' using errcode = '42501';
    end if;
    new.submitted_at = old.submitted_at;
    new.reviewed_by = (select auth.uid());
    new.reviewed_at = now();
    return new;
  else
    raise exception 'A reviewed report cannot be changed.' using errcode = '42501';
  end if;

  -- Draft or being submitted: no review yet.
  new.reviewed_by = null;
  new.reviewed_at = null;
  new.review_note = null;
  if new.status = 'submitted' then
    if new.stats is null then
      raise exception 'A report is submitted with its figures.' using errcode = '23502';
    end if;
    new.submitted_at = now();
  else
    new.submitted_at = null;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_monthly_report_write() from public, anon, authenticated;

create trigger on_monthly_report_written
  before insert or update on public.monthly_reports
  for each row execute function public.guard_monthly_report_write();

alter table public.monthly_reports enable row level security;

revoke all on table public.monthly_reports from anon, authenticated;
grant select on table public.monthly_reports to authenticated;
grant insert (month, status, stats, highlights, next_month_plan, support_needed, pass_downs_confirmed)
  on table public.monthly_reports to authenticated;
-- month is here only because an upsert sets every column it sends; the guard keeps it fixed.
grant update (month, status, stats, highlights, next_month_plan, support_needed,
  pass_downs_confirmed, review_note)
  on table public.monthly_reports to authenticated;

-- The BD Director's report is seen by the MD and HR & Accounts only, as in the prototype.
create policy "monthly reports: own, and managers read"
  on public.monthly_reports for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (kind in ('sales', 'site') and (select public.is_manager()))
    or (kind = 'bd' and (select public.has_job_role('md', 'accounts')))
  );

create policy "monthly reports: file your own"
  on public.monthly_reports for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

create policy "monthly reports: edit your own draft"
  on public.monthly_reports for update
  to authenticated
  using (profile_id = (select auth.uid()) and status = 'draft')
  with check (profile_id = (select auth.uid()));

-- Only a submitted report can be reviewed, and not by the person who wrote it.
create policy "monthly reports: reviewers review"
  on public.monthly_reports for update
  to authenticated
  using (
    status = 'submitted'
    and profile_id <> (select auth.uid())
    and public.can_review_monthly_report(kind)
  )
  with check (
    profile_id <> (select auth.uid())
    and public.can_review_monthly_report(kind)
  );
