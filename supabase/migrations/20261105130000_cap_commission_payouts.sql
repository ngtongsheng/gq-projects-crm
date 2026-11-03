-- A commission payout cannot pass what is payable now (loop 05 audit finding 20). The app read
-- the balance and then wrote, so two payouts at once, or a direct API call, could pass it.
--
-- commission_payable_now is a SQL copy of calculateCommission (src/lib/domain/commission.ts)
-- and commissionBalance (commission-balance.ts) for one person on one order. Keep them in step:
-- supabase/tests/commission-parity.test.ts runs the same cases through both. All money is in
-- whole cents, summed exactly and rounded once per person, half a cent up, as the TypeScript does.
-- Rules come from app_settings with the TypeScript defaults per field, like commission_basis.
--
-- Security definer because it reads the cost; nobody signed in may call it, so the cost (or a
-- figure that gives it away) never leaves the database. Not stable: called after the trigger
-- locks the order, it must see payouts committed while it waited.

create function public.setting_number(stored jsonb, path text[], fallback numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case when jsonb_typeof(stored #> path) = 'number' then (stored #>> path)::numeric end,
    fallback
  );
$$;

revoke execute on function public.setting_number(jsonb, text[], numeric) from public, anon, authenticated;

create function public.commission_payable_now(target_mof uuid, target_person uuid)
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
      public.setting_number(v, '{secondLateCut,afterDays}', 120) as second_after,
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
    left join public.mof_costs costs on costs.mof_id = mofs.id
    left join public.projects on projects.id = mofs.project_id
    where mofs.id = target_mof and mofs.stage <> 'cancelled'
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
        when rc.received_on - o.late_from > r.second_after then r.second_cut
        when rc.received_on - o.late_from > r.first_after then r.first_cut
        else 0
      end as cut_pct
    from received rc cross join the_order o cross join rules r
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

revoke execute on function public.commission_payable_now(uuid, uuid) from public, anon, authenticated;

-- Locks the order row so payouts on it queue up. The messages match the app's, so the screen
-- can show them as they are.
create function public.cap_commission_payouts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payable numeric;
begin
  perform 1 from public.mofs where id = new.mof_id for update;
  if not found then
    return new;
  end if;

  payable := public.commission_payable_now(new.mof_id, new.profile_id);
  if new.amount > payable then
    if payable > 0 then
      raise exception 'That is more than the RM % left to pay out.',
        to_char(payable, 'FM999,999,999,990.00')
        using errcode = 'check_violation';
    end if;
    raise exception 'Nothing can be paid out on this order yet.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.cap_commission_payouts() from public, anon, authenticated;

create trigger limit_commission_payouts_to_payable
  before insert on public.commission_payouts
  for each row execute function public.cap_commission_payouts();
