-- Two-step monthly report review (loop 14 task 08, D6). The person's team lead or the MD
-- reviews a submitted report; then the MD gives the final approval. When the MD reviews, that
-- review is the final approval too. The BD Director's report goes to the MD only, so it goes
-- straight from submitted to approved. Steps: draft -> submitted -> reviewed -> approved.
--
-- Team lead: a Sales or Marketing Director for the salespeople who report to them
-- (in_my_team), and the Sales Director for Site Supervisors, who are in no sales team and
-- whose reports the Sales Director already reads.
--
-- Reports already reviewed before this change count as final-approved (D6 backfill).

alter table public.monthly_reports
  add column approved_by uuid references public.profiles (id),
  add column approved_at timestamptz;

-- Reviewed and approved reports both carry the review.
alter table public.monthly_reports
  drop constraint monthly_reports_check1,
  drop constraint monthly_reports_status_check,
  add constraint monthly_reports_status_check
    check (status in ('draft', 'submitted', 'reviewed', 'approved')),
  add constraint monthly_reports_check1
    check ((status in ('reviewed', 'approved')) = (reviewed_at is not null));

-- Runs without a signed-in user, so the guard below lets it through.
update public.monthly_reports
set status = 'approved', approved_by = reviewed_by, approved_at = reviewed_at
where status = 'reviewed';

alter table public.monthly_reports
  add constraint monthly_reports_approved_check
    check ((status = 'approved') = (approved_at is not null)),
  add constraint monthly_reports_approved_by_check
    check ((approved_by is null) = (approved_at is null));

-- Who may do the first step for this kind of report; the policy below adds the team check for
-- sales reports. Mirrors canReviewReport in report-stats.ts.
create or replace function public.can_review_monthly_report(report_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case report_kind
    when 'bd' then public.has_job_role('md')
    when 'site' then public.has_job_role('md', 'director')
    else public.has_job_role('md', 'director', 'bd')
  end;
$$;

-- Review the reports you may review (sales: only your own team's); the MD approves reviewed ones.
-- Never your own report.
alter policy "monthly reports: reviewers review"
  on public.monthly_reports
  using (
    profile_id <> (select auth.uid())
    and (
      (
        status = 'submitted'
        and public.can_review_monthly_report(kind)
        and (kind <> 'sales' or public.in_my_team(profile_id))
      )
      or (status = 'reviewed' and (select public.has_job_role('md')))
    )
  )
  with check (
    profile_id <> (select auth.uid())
    and public.can_review_monthly_report(kind)
    and (kind <> 'sales' or public.in_my_team(profile_id))
  );

comment on policy "monthly reports: reviewers review" on public.monthly_reports is
  'The team lead or MD reviews a submitted report; the MD approves a reviewed one (loop 14 task 08).';

-- Same as in the report submit-check migration, with the review split into review and approval.
create or replace function public.guard_monthly_report_write()
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
    if new.status in ('reviewed', 'approved') then
      raise exception 'Submit the report before it is reviewed.' using errcode = '42501';
    end if;
  elsif old.status = 'draft' then
    new.profile_id = old.profile_id;
    new.month = old.month;
    new.kind = old.kind;
    if new.status in ('reviewed', 'approved') then
      raise exception 'Submit the report before it is reviewed.' using errcode = '42501';
    end if;
  elsif old.status = 'submitted' then
    if new.status not in ('reviewed', 'approved')
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
    -- The MD's review is the final approval; anyone else's waits for the MD.
    if public.has_job_role('md') then
      new.status = 'approved';
      new.approved_by = (select auth.uid());
      new.approved_at = now();
    elsif new.status = 'approved' or old.kind = 'bd' then
      raise exception 'Only the MD gives the final approval.' using errcode = '42501';
    else
      new.approved_by = null;
      new.approved_at = null;
    end if;
    return new;
  elsif old.status = 'reviewed' then
    if new.status <> 'approved' or not public.has_job_role('md') then
      raise exception 'A reviewed report can only be given the MD''s final approval.'
        using errcode = '42501';
    end if;
    new := old;
    new.status = 'approved';
    new.approved_by = (select auth.uid());
    new.approved_at = now();
    return new;
  else
    raise exception 'An approved report cannot be changed.' using errcode = '42501';
  end if;

  -- Draft or being submitted: no review yet.
  new.reviewed_by = null;
  new.reviewed_at = null;
  new.review_note = null;
  new.approved_by = null;
  new.approved_at = null;
  if new.status = 'submitted' then
    if new.stats is null then
      raise exception 'A report is submitted with its figures.' using errcode = '23502';
    end if;
    if new.kind <> 'site' and (
      select count(*) from jsonb_array_elements(new.highlights) as highlight
      where btrim(coalesce(highlight ->> 'achievement', '')) <> ''
    ) < 3 then
      raise exception 'Fill in at least 3 highlights before submitting.'
        using errcode = 'check_violation';
    end if;
    if new.kind = 'bd' and not new.pass_downs_confirmed then
      raise exception 'Tick the pass-down confirmation before submitting.'
        using errcode = 'check_violation';
    end if;
    new.submitted_at = now();
  else
    new.submitted_at = null;
  end if;
  return new;
end;
$$;

-- Who a filer's report goes to, for "Goes to <lead> & <MD>" on their own report. Staff cannot
-- read other profiles, so this returns just the names, for the signed-in person only.
create function public.my_monthly_report_reviewers()
returns table (full_name text, step text)
language sql
stable
security definer
set search_path = ''
as $$
  select lead.full_name, 'review'
  from public.profiles as me
  join public.profiles as lead on lead.active and lead.id <> me.id and (
    (me.job_role = 'sales' and lead.id = me.reports_to)
    or (me.job_role = 'site' and lead.job_role = 'director')
  )
  where me.id = (select auth.uid())
  union all
  select md.full_name, 'approve'
  from public.profiles as md
  where md.job_role = 'md' and md.active and md.id <> (select auth.uid())
    and exists (
      select 1 from public.profiles as me
      where me.id = (select auth.uid()) and me.job_role in ('sales', 'bd', 'site')
    );
$$;

revoke execute on function public.my_monthly_report_reviewers() from public, anon;
grant execute on function public.my_monthly_report_reviewers() to authenticated;
