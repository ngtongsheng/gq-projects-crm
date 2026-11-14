-- Loop 11 task 05 (D6): Sales Directors and Marketing Directors (bd) read only their team's
-- MOFs, order total changes, payments, commission and monthly sales reports. The MD and HR &
-- Accounts read all. Purchasing keeps reading every payment, and everyone else keeps their MOF
-- reads, for the register and operations. Mirrors the demo's allMoney()/inTeam/tmP and vRep.
-- A Marketing Director with a team now reads that team's money and reports, as in the demo
-- (isMgr counts a BD with a team); without a team, their team is themself, as before.

-- Whether an MOF is sold by my team (either salesperson). Security definer so a policy on
-- another table does not run the mofs policy again for every row.
create function public.mof_in_my_team(mof uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mofs m
    where m.id = mof
      and (public.in_my_team(m.salesperson_id) or public.in_my_team(m.second_salesperson_id))
  );
$$;

revoke execute on function public.mof_in_my_team(uuid) from public, anon;
grant execute on function public.mof_in_my_team(uuid) to authenticated;

-- Policies keep their old names because the migration guard refuses drop policy.
alter policy "mofs: read all"
  on public.mofs
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.in_my_team(salesperson_id)
    or public.in_my_team(second_salesperson_id)
  );

comment on policy "mofs: read all" on public.mofs is
  'Despite the name: Sales and Marketing Directors read only their team''s MOFs (loop 11 task 05); everyone else reads all.';

alter policy "mof total changes: read all"
  on public.mof_total_changes
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.mof_in_my_team(mof_id)
  );

comment on policy "mof total changes: read all" on public.mof_total_changes is
  'Despite the name: Sales and Marketing Directors read only their team''s order total changes (loop 11 task 05); everyone else reads all.';

-- For everyone but Purchasing, mof_in_my_team is: all for MD and HR & Accounts, the team's
-- for directors, and the orders a salesperson is on otherwise, which is the old rule.
alter policy "payments: managers, purchasing and the order's salespeople read"
  on public.payments
  using (
    (select public.has_job_role('support'))
    or public.mof_in_my_team(mof_id)
  );

comment on policy "payments: managers, purchasing and the order's salespeople read" on public.payments is
  'MD, HR & Accounts and Purchasing read all; Sales and Marketing Directors their team''s orders; a salesperson the orders they are on (loop 11 task 05).';

-- Scoped by who is paid, as the demo's commission lines are (inTeam(line.who)).
alter policy "commission payouts: own and managers read"
  on public.commission_payouts
  using (
    profile_id = (select auth.uid())
    or (select public.has_job_role('md', 'accounts'))
    or ((select public.has_job_role('director', 'bd')) and public.in_my_team(profile_id))
  );

comment on policy "commission payouts: own and managers read" on public.commission_payouts is
  'Own payouts; MD and HR & Accounts read all; Sales and Marketing Directors their team''s (loop 11 task 05).';

-- Site supervisors are in no sales team: the Sales Director keeps reading their reports.
alter policy "monthly reports: own, and managers read"
  on public.monthly_reports
  using (
    profile_id = (select auth.uid())
    or (select public.has_job_role('md', 'accounts'))
    or (kind = 'site' and (select public.has_job_role('director')))
    or (
      kind = 'sales'
      and (select public.has_job_role('director', 'bd'))
      and public.in_my_team(profile_id)
    )
  );

comment on policy "monthly reports: own, and managers read" on public.monthly_reports is
  'Own reports; MD and HR & Accounts read all; the Sales Director reads site reports and, with the Marketing Director, their team''s sales reports (loop 11 task 05).';

-- Same columns as before; only who is listed changes, matching the monthly reports policy.
create or replace function public.report_filers()
returns table (id uuid, full_name text, job_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, full_name, job_role
  from public.profiles
  where (job_role in ('sales', 'site', 'bd') and public.has_job_role('md', 'accounts'))
    or (job_role = 'site' and public.has_job_role('director'))
    or (job_role = 'sales' and public.has_job_role('director', 'bd') and public.in_my_team(id));
$$;

-- As before, plus: Sales and Marketing Directors get their team's orders only.
create or replace function public.commission_basis()
returns table (
  mof_id uuid,
  margin_tier text,
  salesperson_mode text,
  second_salesperson_mode text,
  passed_by_id uuid,
  passed_by_mode text
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select (select auth.uid()) as id,
      (select public.has_job_role('md', 'accounts', 'director', 'bd')) as manager
  ),
  rules as (
    select
      coalesce(case when jsonb_typeof(v -> 'noCommissionBelowPct') = 'number'
        then (v ->> 'noCommissionBelowPct')::numeric end, 20) as none_below,
      coalesce(case when jsonb_typeof(v -> 'lowMarginBelowPct') = 'number'
        then (v ->> 'lowMarginBelowPct')::numeric end, 30) as low_below,
      coalesce(case when jsonb_typeof(v -> 'highMarginAbovePct') = 'number'
        then (v ->> 'highMarginAbovePct')::numeric end, 45) as high_above
    from (select (select value from public.app_settings where key = 'commission') as v) stored
  )
  select
    mofs.id,
    case
      when costs.cost is null then 'unknown'
      -- (total - cost) / total against a percentage, kept as a product so nothing rounds.
      when (totals.total - costs.cost) * 100 < rules.none_below * totals.total then 'none'
      when (totals.total - costs.cost) * 100 < rules.low_below * totals.total then 'low'
      when (totals.total - costs.cost) * 100 > rules.high_above * totals.total then 'high'
      else 'standard'
    end,
    first_person.commission_mode,
    second_person.commission_mode,
    projects.passed_by,
    passer.commission_mode
  from public.mofs
  cross join caller
  cross join rules
  cross join lateral (select mofs.contract_sum + mofs.vo_amount as total) totals
  left join public.mof_costs costs on costs.mof_id = mofs.id
  left join public.projects on projects.id = mofs.project_id
  left join public.profiles first_person on first_person.id = mofs.salesperson_id
  left join public.profiles second_person on second_person.id = mofs.second_salesperson_id
  left join public.profiles passer on passer.id = projects.passed_by
  where caller.id is not null
    and (
      caller.id in (mofs.salesperson_id, mofs.second_salesperson_id)
      or (caller.manager
        and (public.in_my_team(mofs.salesperson_id) or public.in_my_team(mofs.second_salesperson_id)))
    );
$$;
