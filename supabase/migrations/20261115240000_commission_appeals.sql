-- Late-collection cut and appeals (loop 14 task 05, D3 and D4).
--
-- D3: the second late cut starts after 180 days instead of 120. The saved rules change only
-- where they still hold 120, so a value the MD chose herself stays. Commission is worked out
-- from the rules each time, so every unpaid amount follows; payouts already made are stored
-- amounts and never change.
--
-- D4: a salesperson appeals the late cut on their commission for one order; the MD or HR &
-- Accounts approves or rejects it with a note. An approved appeal sets that person's late cut on
-- that order to 0. A rejected appeal stays on record and a new one may be sent.

update public.app_settings
set value = jsonb_set(value, '{secondLateCut,afterDays}', '180'::jsonb)
where key = 'commission'
  and value #> '{secondLateCut,afterDays}' = '120'::jsonb
  -- The second cut must start after the first; leave rules that would break that to the MD.
  and jsonb_typeof(value #> '{firstLateCut,afterDays}') = 'number'
  and (value #>> '{firstLateCut,afterDays}')::numeric < 180;

create table public.commission_appeals (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  -- Whose commission it is: whoever sends it; never part of the insert grant, so it cannot be faked.
  profile_id uuid not null default auth.uid() references public.profiles (id),
  reason text not null check (reason = btrim(reason) and char_length(reason) >= 10),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- The decider's note to the salesperson.
  reply text check (reply is null or (reply = btrim(reply) and reply <> '')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending') = (decided_by is null)),
  check ((decided_by is null) = (decided_at is null)),
  check ((status = 'pending') = (reply is null))
);

create index commission_appeals_mof_id_idx on public.commission_appeals (mof_id);
create index commission_appeals_profile_id_idx on public.commission_appeals (profile_id);

-- One open or approved appeal per person per order; a rejected one may be followed by another.
create unique index commission_appeals_one_standing_idx
  on public.commission_appeals (mof_id, profile_id)
  where status <> 'rejected';

-- A decision records who and when, from the server's clock and the signed-in user.
create function public.stamp_commission_appeal_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end;
$$;

revoke execute on function public.stamp_commission_appeal_decision() from public, anon, authenticated;

create trigger stamp_commission_appeal_decision
  before update on public.commission_appeals
  for each row execute function public.stamp_commission_appeal_decision();

alter table public.commission_appeals enable row level security;

revoke all on table public.commission_appeals from anon, authenticated;
grant select on table public.commission_appeals to authenticated;
grant insert (mof_id, reason) on table public.commission_appeals to authenticated;
-- Deciding is the only change after an appeal is sent.
grant update (status, reply) on table public.commission_appeals to authenticated;

-- Scoped by whose commission it is, as commission payouts are.
create policy "commission appeals: own and managers read"
  on public.commission_appeals for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select public.has_job_role('md', 'accounts'))
    or ((select public.has_job_role('director', 'bd')) and public.in_my_team(profile_id))
  );

create policy "commission appeals: send your own"
  on public.commission_appeals for insert
  to authenticated
  with check (profile_id = (select auth.uid()) and status = 'pending');

-- Only a pending appeal can be decided, once, and not on your own commission.
create policy "commission appeals: md and accounts decide"
  on public.commission_appeals for update
  to authenticated
  using (
    status = 'pending'
    and profile_id <> (select auth.uid())
    and (select public.has_job_role('md', 'accounts'))
  )
  with check (
    status in ('approved', 'rejected')
    and profile_id <> (select auth.uid())
    and (select public.has_job_role('md', 'accounts'))
  );

-- As before (variation orders), with the second late cut defaulting to 180 days and no late cut
-- for a person whose appeal on the order was approved.
create or replace function public.commission_payable_now(target_mof uuid, target_person uuid)
returns numeric
language sql
security definer
set search_path = ''
as $$
  with stored as (
    select
      (select value from public.app_settings where key = 'commission') as v,
      (select value from public.app_settings where key = 'payment_threshold_pct') as threshold
  ),
  rules as (
    select
      public.setting_number(v, '{baseRatePct,own}', 3) as own_rate,
      public.setting_number(v, '{baseRatePct,pass_down}', 1.5) as pass_down_rate,
      public.setting_number(v, '{baseRatePct,company}', 1.5) as company_rate,
      public.setting_number(v, '{noCommissionBelowPct}', 20) as none_below,
      public.setting_number(v, '{lowMarginBelowPct}', 30) as low_below,
      public.setting_number(v, '{lowMarginRatePct,own}', 1.5) as low_own_rate,
      public.setting_number(v, '{lowMarginRatePct,other}', 1) as low_other_rate,
      public.setting_number(v, '{highMarginAbovePct}', 45) as high_above,
      public.setting_number(v, '{highMarginBonusPct}', 1) as high_bonus,
      public.setting_number(v, '{firstLateCut,afterDays}', 90) as first_after,
      public.setting_number(v, '{firstLateCut,cutPct}', 25) as first_cut,
      public.setting_number(v, '{secondLateCut,afterDays}', 180) as second_after,
      public.setting_number(v, '{secondLateCut,cutPct}', 50) as second_cut,
      public.setting_number(v, '{splitSharePct}', 50) as split_share,
      public.setting_number(v, '{flatPassDownRatePct}', 1) as flat_rate,
      public.setting_number(threshold, '{}', 90) as claim_threshold
    from stored
  ),
  the_order as (
    select
      mofs.id,
      mofs.commission_type as kind,
      (mofs.contract_sum + mofs.vo_amount) * 100 as total_cents,
      costs.cost * 100 as cost_cents,
      coalesce(mofs.invoice_date, mofs.loa_date) as late_from,
      mofs.salesperson_id,
      mofs.second_salesperson_id,
      projects.passed_by
    from public.mofs
    left join public.mof_cost_totals costs on costs.mof_id = mofs.id
    left join public.projects on projects.id = mofs.project_id
    where mofs.id = target_mof and mofs.stage <> 'cancelled'
  ),
  waiver as (
    select exists (
      select 1 from public.commission_appeals a
      where a.mof_id = target_mof and a.profile_id = target_person and a.status = 'approved'
    ) as late_cut_waived
  ),
  tier as (
    -- (total - cost) / total against a percentage, kept as whole numbers as marginTier does.
    select case
      when o.cost_cents is null then 'unknown'
      when (o.total_cents - o.cost_cents) * 10000 < round(r.none_below * 100) * o.total_cents then 'none'
      when (o.total_cents - o.cost_cents) * 10000 < round(r.low_below * 100) * o.total_cents then 'low'
      when (o.total_cents - o.cost_cents) * 10000 > round(r.high_above * 100) * o.total_cents then 'high'
      else 'standard'
    end as name
    from the_order o cross join rules r
  ),
  received as (
    select p.amount * 100 as cents, p.received_on,
      coalesce(sum(p.amount * 100) over (
        order by p.received_on, p.id rows between unbounded preceding and 1 preceding
      ), 0) as before_cents
    from public.payments p
    where p.mof_id = target_mof
  ),
  collection as (
    -- summariseCollection: fully paid, or at least the claim threshold.
    select coalesce(sum(cents), 0) >= o.total_cents
      or coalesce(sum(cents), 0) * 10000 >= round(r.claim_threshold * 100) * o.total_cents
      as threshold_met
    from the_order o cross join rules r left join received on true
    group by o.total_cents, r.claim_threshold
  ),
  counted as (
    -- Each payment counts only up to what is still owed; money past the order total earns nothing.
    select
      least(rc.cents, greatest(0, o.total_cents - rc.before_cents)) as cents,
      case
        when w.late_cut_waived then 0
        when rc.received_on - o.late_from > r.second_after then r.second_cut
        when rc.received_on - o.late_from > r.first_after then r.first_cut
        else 0
      end as cut_pct
    from received rc cross join the_order o cross join rules r cross join waiver w
  ),
  shares as (
    select o.salesperson_id as person_id,
      case when o.second_salesperson_id is null then 100 else r.split_share end as share_pct
    from the_order o cross join rules r
    union all
    select o.second_salesperson_id, 100 - r.split_share
    from the_order o cross join rules r
    where o.second_salesperson_id is not null
    union all
    -- The person who passed the customer down keeps their flat rate on the whole sale.
    select o.passed_by, 100
    from the_order o
    join public.profiles passer on passer.id = o.passed_by
    where o.kind = 'pass_down'
      and passer.commission_mode = 'flat_pass_down'
      and o.passed_by is distinct from o.salesperson_id
      and o.passed_by is distinct from o.second_salesperson_id
  ),
  person as (
    select s.share_pct, coalesce(people.commission_mode, 'standard') = 'flat_pass_down' as flat
    from shares s
    left join public.profiles people on people.id = s.person_id
    where s.person_id = target_person
      and coalesce(people.commission_mode, 'standard') <> 'excluded'
  ),
  rate as (
    select p.share_pct, case
      when t.name = 'none' then 0
      when t.name = 'low' then least(base.pct, case
        when p.flat then r.flat_rate
        when o.kind = 'own' then r.low_own_rate
        else r.low_other_rate
      end)
      when t.name = 'high' and not p.flat then base.pct + r.high_bonus
      else base.pct
    end as pct
    from person p
    cross join the_order o
    cross join tier t
    cross join rules r
    cross join lateral (
      select case
        when p.flat then r.flat_rate
        when o.kind = 'own' then r.own_rate
        when o.kind = 'pass_down' then r.pass_down_rate
        else r.company_rate
      end as pct
    ) base
  ),
  earned as (
    select
      round(coalesce(sum(c.cents), 0) * ra.pct * ra.share_pct / 10000)
        - round(coalesce(sum(c.cents * c.cut_pct), 0) * ra.pct * ra.share_pct / 1000000) as cents
    from rate ra left join counted c on true
    group by ra.pct, ra.share_pct
  ),
  paid_out as (
    select coalesce(sum(amount * 100), 0) as cents
    from public.commission_payouts
    where mof_id = target_mof and profile_id = target_person
  )
  select coalesce((
    select case
      when col.threshold_met and t.name <> 'unknown' and e.cents > 0
        then greatest(0, e.cents - po.cents) / 100
      else 0
    end
    from earned e cross join collection col cross join tier t cross join paid_out po
  ), 0)::numeric(14,2);
$$;
