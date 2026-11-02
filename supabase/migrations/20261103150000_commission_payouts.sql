-- Commission paid out to a person on an order (loop 03 task 26). A person reads their own
-- payouts; the MD, Sales Director and HR & Accounts read everyone's. Only the MD and HR &
-- Accounts record a payout, or remove one entered by mistake. Payouts are never edited.

create table public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  mof_id uuid not null references public.mofs (id),
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null,
  note text check (note is null or (note = btrim(note) and note <> '')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create index commission_payouts_mof_id_idx on public.commission_payouts (mof_id);
create index commission_payouts_profile_id_idx on public.commission_payouts (profile_id);

alter table public.commission_payouts enable row level security;

revoke all on table public.commission_payouts from anon, authenticated;
grant select, delete on table public.commission_payouts to authenticated;
grant insert (profile_id, mof_id, amount, paid_on, note)
  on table public.commission_payouts to authenticated;

create policy "commission payouts: own and managers read"
  on public.commission_payouts for select
  to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_manager()));

create policy "commission payouts: md and accounts record"
  on public.commission_payouts for insert
  to authenticated
  with check ((select public.has_job_role('md', 'accounts')));

create policy "commission payouts: md and accounts remove"
  on public.commission_payouts for delete
  to authenticated
  using ((select public.has_job_role('md', 'accounts')));

-- What the commission calculation needs from the cost, without the cost. Salespeople cannot
-- read mof_costs (D12), so this returns only the margin tier, never the cost or the margin
-- itself (with the order total either would give the cost away). Managers get every order; a
-- salesperson only the orders they are on. The tier uses the rules the MD saved in
-- app_settings (key 'commission'), falling back to the prototype's 20 / 30 / 45 per field.
-- It also carries the commission mode of the people on the order: staff cannot read other
-- profiles, and the calculation needs to know who is excluded or on the flat rate.
create function public.commission_basis()
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
    select (select auth.uid()) as id, (select public.is_manager()) as manager
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
    and (caller.manager or caller.id in (mofs.salesperson_id, mofs.second_salesperson_id));
$$;

revoke execute on function public.commission_basis() from public, anon;
grant execute on function public.commission_basis() to authenticated;
