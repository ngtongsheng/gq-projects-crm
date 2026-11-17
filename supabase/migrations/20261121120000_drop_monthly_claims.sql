-- Loop 25 task 05 (D1, D7): the travel claim replaced the monthly claim, so the monthly claim goes:
-- its four tables with their triggers and policies, its functions, its receipt upload area and the
-- claim settings only it used. Receipt files already in the bucket stay (docs/debt.md).
-- claim_people() stays: the travel claims list uses it. commission_appeals stays (D2).

-- Uploads under claims/ are refused from now on. Same body as before without the claims branch.
create or replace function public.can_attach(area text, record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active() and case area
    when 'leave' then exists (
      select 1 from public.leave_requests r
      where r.id = record_id
        and (r.person_id = (select auth.uid()) or public.has_job_role('md', 'accounts'))
    )
    when 'tasks' then
      public.assigned_task(record_id) or public.works_on_task(record_id)
    when 'hr-policies' then
      public.has_job_role('md', 'accounts')
    else false
  end;
$$;

-- Children first; dropping a table drops its triggers, indexes and policies.
drop table public.monthly_claim_log;
drop table public.monthly_claim_commissions;
drop table public.monthly_claim_expenses;
drop table public.monthly_claims;

drop function public.approve_monthly_claim(uuid);
drop function public.monthly_claim_ot_amount(uuid);
drop function public.can_see_monthly_claim(uuid);
drop function public.owns_open_monthly_claim(uuid);
drop function public.adjusts_monthly_claim(uuid);
drop function public.guard_monthly_claim_write();
drop function public.after_monthly_claim_status();
drop function public.guard_monthly_claim_line_write();
drop function public.prepare_monthly_claim_expense();
drop function public.prepare_monthly_claim_commission();

-- D7: the cut-off day is the only claim setting left and nobody edits it in the app, so HR &
-- Accounts no longer writes the claims key (the MD's and admins' own setting policies stay).
drop policy "app_settings: accounts add claim settings" on public.app_settings;
drop policy "app_settings: accounts change claim settings" on public.app_settings;

update public.app_settings
set value = jsonb_build_object('cutOffDay', value -> 'cutOffDay')
where key = 'claims';
