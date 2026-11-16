-- Loop 19 task 03: the two claim steps that must happen inside the database.
--
-- Section C in ringgit, frozen at submit: the claim period's OT hours approved as an OT claim
-- (not replacement leave) times the person's OT rate, basic / 26 days / 8 hours x 1.5 (demo
-- otRateEst), from the HR package in force on the cut-off day. Zero without a package.
-- Security definer: the person cannot read their package; only the amount comes back. Null
-- when the caller may not see the claim.
create function public.monthly_claim_ot_amount(claim uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with claimed as (
    select
      c.profile_id,
      -- claimPeriod in monthly-claim.ts: the day after last month's cut-off up to this month's.
      (c.month - interval '1 month')::date + s.cut_off as from_day,
      c.month + s.cut_off - 1 as to_day
    from public.monthly_claims c
    cross join (
      select coalesce((
        select (value ->> 'cutOffDay')::integer from public.app_settings where key = 'claims'
      ), 25) as cut_off
    ) s
    where c.id = claim
      and (c.profile_id = (select auth.uid()) or public.has_job_role('md', 'accounts'))
  )
  select round(
    coalesce((
      select sum(o.hours) from public.ot_claims o
      where o.profile_id = claimed.profile_id
        and o.status = 'approved'
        and o.approved_as = 'ot'
        and o.work_date between claimed.from_day and claimed.to_day
    ), 0)
    * coalesce((
      select p.basic from public.staff_packages p
      where p.profile_id = claimed.profile_id and p.effective_on <= claimed.to_day
      order by p.effective_on desc
      limit 1
    ), 0) / 26 / 8 * 1.5,
    2
  )::numeric(12, 2)
  from claimed;
$$;

revoke execute on function public.monthly_claim_ot_amount(uuid) from public, anon;
grant execute on function public.monthly_claim_ot_amount(uuid) to authenticated;

-- Approving a claim records its commission lines as paid out (demo clApp), in the same
-- transaction, so a line is never approved without its payout or paid twice: payable-now
-- drops by the payout, and the line stops being pending once the claim is paid. Security
-- invoker: the claim's guard and the payout policies and cap apply to the caller as usual.
create function public.approve_monthly_claim(claim uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  approved public.monthly_claims;
begin
  update public.monthly_claims
  set status = 'approved'
  where id = claim and status in ('submitted', 'checked')
  returning * into approved;
  if not found then
    raise exception 'This claim is not waiting for approval.' using errcode = 'P0002';
  end if;

  insert into public.commission_payouts (profile_id, mof_id, amount, paid_on, note)
  select
    approved.profile_id,
    line.mof_id,
    line.amount,
    (now() at time zone 'Asia/Kuala_Lumpur')::date,
    'Monthly claim ' || to_char(approved.month, 'Mon YYYY')
  from public.monthly_claim_commissions line
  where line.claim_id = approved.id and line.amount > 0;
end;
$$;

revoke execute on function public.approve_monthly_claim(uuid) from public, anon;
grant execute on function public.approve_monthly_claim(uuid) to authenticated;
