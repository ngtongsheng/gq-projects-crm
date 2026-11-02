-- Submitting a sales or BD report needs at least 3 highlights, and the BD Director's needs the
-- pass-down confirmation ticked (MIN_HIGHLIGHTS and the submit checks in reports/actions.ts).
-- The app checked these alone, so a direct API call could submit without them. Same guard as in
-- the monthly reports migration, with both checks added to the submit branch.

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
