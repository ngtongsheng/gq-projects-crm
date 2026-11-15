-- Variation orders (loop 14 D1, demo sheetVO / p.vos[]). A VO stays under its MOF: number,
-- client VO / PO reference, the date it was confirmed, a signed amount (negative for an
-- omission or credit note), what it is, the extra area or quantity, and whether it needs
-- delivery or installation. mofs.vo_amount stays, because commission, payments and policies
-- read it, but it is now always the sum of the MOF's VOs: a trigger keeps it so, and save_mof,
-- update_mof_total and import_mofs no longer set it themselves.
--
-- A VO's cost sits in its own table that only cost readers see, like mof_costs (loop 03 D12).
-- mof_cost_totals is the MOF cost the app and commission use: the MOF's cost plus its VOs'.
--
-- Backfill: each MOF with a VO amount gets one VO for that amount, dated at the MOF's LOA date,
-- so every order total and every month's sales stay as they were. Nothing is removed.

create table public.mof_variation_orders (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  vo_no text not null check (vo_no = btrim(vo_no) and vo_no <> ''),
  client_ref text check (client_ref = btrim(client_ref) and client_ref <> ''),
  confirmed_on date not null,
  -- Negative for an omission or credit note. Zero only for extra work at no charge.
  amount numeric(14,2) not null,
  description text not null check (description = btrim(description) and description <> ''),
  -- Free text as on the sheet, e.g. "120 m2 · 30 boxes".
  qty text check (qty = btrim(qty) and qty <> ''),
  needs_work boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  unique (mof_id, vo_no),
  check (amount <> 0 or needs_work)
);

create index mof_variation_orders_mof_id_idx on public.mof_variation_orders (mof_id);

alter table public.mof_variation_orders enable row level security;

revoke all on table public.mof_variation_orders from anon, authenticated;
grant select, delete on table public.mof_variation_orders to authenticated;
grant insert (mof_id, vo_no, client_ref, confirmed_on, amount, description, qty, needs_work)
  on table public.mof_variation_orders to authenticated;
grant update (vo_no, client_ref, confirmed_on, amount, description, qty, needs_work)
  on table public.mof_variation_orders to authenticated;

-- Read like the MOF itself: Sales and Marketing Directors their team's, everyone else all.
create policy "variation orders: read with the mof"
  on public.mof_variation_orders for select
  to authenticated
  using (
    not (select public.has_job_role('director', 'bd'))
    or public.mof_in_my_team(mof_id)
  );

create policy "variation orders: register editors add"
  on public.mof_variation_orders for insert
  to authenticated
  with check ((select public.has_job_role('md', 'support', 'accounts')));

create policy "variation orders: register editors edit"
  on public.mof_variation_orders for update
  to authenticated
  using ((select public.has_job_role('md', 'support', 'accounts')))
  with check ((select public.has_job_role('md', 'support', 'accounts')));

create policy "variation orders: register editors remove"
  on public.mof_variation_orders for delete
  to authenticated
  using ((select public.has_job_role('md', 'support', 'accounts')));

create policy "left people: no access"
  on public.mof_variation_orders
  as restrictive
  for all
  to authenticated
  using ((select public.is_active()))
  with check ((select public.is_active()));

-- A VO's cost goes with the VO.
create table public.mof_variation_order_costs (
  variation_order_id uuid primary key references public.mof_variation_orders (id) on delete cascade,
  cost numeric(14,2) not null check (cost >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

alter table public.mof_variation_order_costs enable row level security;

revoke all on table public.mof_variation_order_costs from anon, authenticated;
grant select on table public.mof_variation_order_costs to authenticated;
grant insert (variation_order_id, cost) on table public.mof_variation_order_costs to authenticated;
grant update (cost) on table public.mof_variation_order_costs to authenticated;

create policy "variation order costs: cost readers read"
  on public.mof_variation_order_costs for select
  to authenticated
  using ((select public.can_see_mof_cost()));

create policy "variation order costs: cost readers add"
  on public.mof_variation_order_costs for insert
  to authenticated
  with check ((select public.can_see_mof_cost()));

create policy "variation order costs: cost readers edit"
  on public.mof_variation_order_costs for update
  to authenticated
  using ((select public.can_see_mof_cost()))
  with check ((select public.can_see_mof_cost()));

create policy "left people: no access"
  on public.mof_variation_order_costs
  as restrictive
  for all
  to authenticated
  using ((select public.is_active()))
  with check ((select public.is_active()));

-- The MOF cost with its VOs' costs added. Only MOFs that have a cost: a VO cost alone would
-- make an uncosted order look costed. Security invoker, so cost readers alone see rows.
create view public.mof_cost_totals
  with (security_invoker = true)
as
  select c.mof_id,
    c.cost + coalesce((
      select sum(vc.cost)
      from public.mof_variation_order_costs vc
      join public.mof_variation_orders v on v.id = vc.variation_order_id
      where v.mof_id = c.mof_id
    ), 0) as cost
  from public.mof_costs c;

revoke all on table public.mof_cost_totals from anon, authenticated;
grant select on table public.mof_cost_totals to authenticated;

-- D1 backfill, before the trigger exists: the totals already include these amounts.
insert into public.mof_variation_orders (mof_id, vo_no, confirmed_on, amount, description,
  needs_work, created_by)
select m.id, 'VO1', m.loa_date, m.vo_amount, 'Variation orders before the VO list', false,
  null
from public.mofs m
where m.vo_amount <> 0;

-- Keeps mofs.vo_amount equal to the sum of the MOF's VOs and records the change in order
-- total, as update_mof_total does. Locks the MOF first, so VOs saved at the same time queue
-- up and each sum sees the others. Security definer because nobody may update vo_amount.
create function public.sync_mof_vo_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vo public.mof_variation_orders;
  current_mof public.mofs;
  vo_sum numeric;
begin
  if tg_op = 'DELETE' then
    vo := old;
  else
    vo := new;
  end if;

  select * into current_mof from public.mofs m where m.id = vo.mof_id for update;

  select coalesce(sum(v.amount), 0) into vo_sum
  from public.mof_variation_orders v
  where v.mof_id = vo.mof_id;

  if vo_sum = current_mof.vo_amount then
    return null;
  end if;

  insert into public.mof_total_changes (mof_id, old_total, new_total, reason)
  values (
    current_mof.id,
    current_mof.contract_sum + current_mof.vo_amount,
    current_mof.contract_sum + vo_sum,
    case
      when tg_op = 'DELETE' then vo.vo_no || ' deleted'
      else vo.vo_no || coalesce(' (' || vo.client_ref || ')', '') || ': ' || vo.description
    end
  );

  update public.mofs m set vo_amount = vo_sum where m.id = current_mof.id;
  return null;
end;
$$;

revoke execute on function public.sync_mof_vo_amount() from public, anon, authenticated;

create trigger keep_mof_vo_amount_in_step
  after insert or update or delete on public.mof_variation_orders
  for each row execute function public.sync_mof_vo_amount();

-- Nobody signed in sets vo_amount on a new MOF any more; it starts at 0 and follows the VOs.
revoke insert (vo_amount) on table public.mofs from authenticated;

-- As before, except that the VO part of the total no longer changes here: a different
-- vo_amount is refused and points to the VO list.
create or replace function public.update_mof_total(
  mof_id uuid,
  contract_sum numeric,
  vo_amount numeric,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_mof public.mofs;
begin
  if not (select public.has_job_role('md', 'support', 'accounts')) then
    raise exception 'Only the MD, Purchasing or HR & Accounts can change the order total.'
      using errcode = '42501';
  end if;

  if btrim(coalesce(update_mof_total.reason, '')) = '' then
    raise exception 'Give the reason for the change in order total.'
      using errcode = '22023';
  end if;

  select * into current_mof
  from public.mofs m
  where m.id = update_mof_total.mof_id
  for update;

  if not found then
    raise exception 'MOF not found.' using errcode = 'P0002';
  end if;

  if round(update_mof_total.vo_amount, 2) <> current_mof.vo_amount then
    raise exception 'Add or change variation orders on the MOF''s VO list.'
      using errcode = '22023';
  end if;

  insert into public.mof_total_changes (mof_id, old_total, new_total, reason)
  values (
    current_mof.id,
    current_mof.contract_sum + current_mof.vo_amount,
    round(update_mof_total.contract_sum, 2) + current_mof.vo_amount,
    btrim(update_mof_total.reason)
  );

  update public.mofs m
  set contract_sum = round(update_mof_total.contract_sum, 2)
  where m.id = current_mof.id;
end;
$$;

-- save_mof as before (loop 07, contact columns), except that vo_amount is no longer written:
-- a new MOF starts at 0 and a changed vo_amount is refused, pointing to the VO list.
create or replace function public.save_mof(
  mof_id uuid,
  mof jsonb,
  lines jsonb,
  reason text,
  cost numeric
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  posted public.mofs;
  saved public.mofs;
  mid uuid := save_mof.mof_id;
begin
  posted := jsonb_populate_record(null::public.mofs, save_mof.mof);

  if mid is null then
    if coalesce(posted.vo_amount, 0) <> 0 then
      raise exception 'Add variation orders on the MOF''s VO list.' using errcode = '22023';
    end if;

    insert into public.mofs (mof_no, loa_date, salesperson_id, second_salesperson_id,
      project_id, company_name, project_name, loa_no, quote_no, site_address,
      site_contact_name, site_contact_mobile, office_pic_id, customer_contact,
      accounts_contact, customer_name, customer_mobile, accounts_name, accounts_mobile,
      accounts_email, scope, installer_name, contract_sum, retention_pct,
      invoice_no, invoice_date, commission_type, delivery_date, stage, latest_update,
      payment_checked, approvals_in_writing, artwork_signed_off, dos_pre_approved)
    values (posted.mof_no, posted.loa_date, posted.salesperson_id,
      posted.second_salesperson_id, posted.project_id, posted.company_name,
      posted.project_name, posted.loa_no, posted.quote_no, posted.site_address,
      posted.site_contact_name, posted.site_contact_mobile, posted.office_pic_id,
      posted.customer_contact, posted.accounts_contact, posted.customer_name,
      posted.customer_mobile, posted.accounts_name, posted.accounts_mobile,
      posted.accounts_email, posted.scope, posted.installer_name,
      posted.contract_sum, posted.retention_pct, posted.invoice_no,
      posted.invoice_date, posted.commission_type, posted.delivery_date, posted.stage,
      posted.latest_update, posted.payment_checked, posted.approvals_in_writing,
      posted.artwork_signed_off, posted.dos_pre_approved)
    returning id into mid;
  else
    select * into saved from public.mofs m where m.id = mid;
    if not found then
      raise exception 'MOF not found.' using errcode = 'P0002';
    end if;
    if round(posted.vo_amount, 2) <> saved.vo_amount then
      raise exception 'Add or change variation orders on the MOF''s VO list.'
        using errcode = '22023';
    end if;

    update public.mofs m set
      mof_no = posted.mof_no,
      loa_date = posted.loa_date,
      salesperson_id = posted.salesperson_id,
      second_salesperson_id = posted.second_salesperson_id,
      project_id = posted.project_id,
      company_name = posted.company_name,
      project_name = posted.project_name,
      loa_no = posted.loa_no,
      quote_no = posted.quote_no,
      site_address = posted.site_address,
      site_contact_name = posted.site_contact_name,
      site_contact_mobile = posted.site_contact_mobile,
      office_pic_id = posted.office_pic_id,
      customer_contact = posted.customer_contact,
      accounts_contact = posted.accounts_contact,
      customer_name = posted.customer_name,
      customer_mobile = posted.customer_mobile,
      accounts_name = posted.accounts_name,
      accounts_mobile = posted.accounts_mobile,
      accounts_email = posted.accounts_email,
      scope = posted.scope,
      installer_name = posted.installer_name,
      retention_pct = posted.retention_pct,
      invoice_no = posted.invoice_no,
      invoice_date = posted.invoice_date,
      commission_type = posted.commission_type,
      delivery_date = posted.delivery_date,
      stage = posted.stage,
      latest_update = posted.latest_update,
      payment_checked = posted.payment_checked,
      approvals_in_writing = posted.approvals_in_writing,
      artwork_signed_off = posted.artwork_signed_off,
      dos_pre_approved = posted.dos_pre_approved
    where m.id = mid;
    if not found then
      raise exception 'Only the MD, Purchasing or HR & Accounts can register or change an MOF.'
        using errcode = '42501';
    end if;
  end if;

  delete from public.mof_lines l
  where l.mof_id = mid
    and l.id not in (
      select (line ->> 'id')::uuid
      from jsonb_array_elements(save_mof.lines) as line
      where line ->> 'id' is not null
    );

  update public.mof_lines l set
    product = posted_line.product,
    stock_type = posted_line.stock_type,
    supplier = posted_line.supplier,
    qty = posted_line.qty,
    unit = posted_line.unit,
    area_m2 = posted_line.area_m2
  from jsonb_populate_recordset(null::public.mof_lines, save_mof.lines) as posted_line
  where posted_line.id is not null
    and l.id = posted_line.id
    and l.mof_id = mid;

  insert into public.mof_lines (mof_id, product, stock_type, supplier, qty, unit, area_m2)
  select mid, posted_line.product, posted_line.stock_type, posted_line.supplier,
    posted_line.qty, posted_line.unit, posted_line.area_m2
  from jsonb_populate_recordset(null::public.mof_lines, save_mof.lines) as posted_line
  where posted_line.id is null;

  if saved.id is not null and round(posted.contract_sum, 2) <> saved.contract_sum then
    perform public.update_mof_total(mid, posted.contract_sum, saved.vo_amount,
      save_mof.reason);
  end if;

  if save_mof.cost is not null then
    update public.mof_costs c set cost = save_mof.cost where c.mof_id = mid;
    if not found then
      insert into public.mof_costs (mof_id, cost) values (mid, save_mof.cost);
    end if;
  end if;

  return mid;
end;
$$;

-- import_mofs as before, except that a pasted VO amount becomes a VO instead of being written to
-- vo_amount: for a new MOF one VO dated at its LOA date (as the backfill), for a saved MOF one VO
-- for the difference, dated today.
create or replace function public.import_mofs(import_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  mid uuid;
  cur public.mofs;
  new_sum numeric;
  vo_change numeric;
  vo_date date;
begin
  for r in select value from jsonb_array_elements(import_rows) loop
    if r ? 'id' then
      mid := (r ->> 'id')::uuid;
      select * into cur from public.mofs m where m.id = mid;
      if not found then
        raise exception 'MOF % could not be updated.', mid;
      end if;

      update public.mofs m set
        mof_no = case when r ? 'mof_no' then r ->> 'mof_no' else m.mof_no end,
        loa_date = case when r ? 'loa_date' then (r ->> 'loa_date')::date else m.loa_date end,
        salesperson_id = case when r ? 'salesperson_id' then (r ->> 'salesperson_id')::uuid else m.salesperson_id end,
        second_salesperson_id = case when r ? 'second_salesperson_id' then (r ->> 'second_salesperson_id')::uuid else m.second_salesperson_id end,
        company_name = case when r ? 'company_name' then r ->> 'company_name' else m.company_name end,
        project_name = case when r ? 'project_name' then r ->> 'project_name' else m.project_name end,
        loa_no = case when r ? 'loa_no' then r ->> 'loa_no' else m.loa_no end,
        quote_no = case when r ? 'quote_no' then r ->> 'quote_no' else m.quote_no end,
        site_address = case when r ? 'site_address' then r ->> 'site_address' else m.site_address end,
        customer_contact = case when r ? 'customer_contact' then r ->> 'customer_contact' else m.customer_contact end,
        accounts_contact = case when r ? 'accounts_contact' then r ->> 'accounts_contact' else m.accounts_contact end,
        scope = case when r ? 'scope' then r ->> 'scope' else m.scope end,
        installer_name = case when r ? 'installer_name' then r ->> 'installer_name' else m.installer_name end,
        retention_pct = case when r ? 'retention_pct' then (r ->> 'retention_pct')::numeric else m.retention_pct end,
        invoice_no = case when r ? 'invoice_no' then r ->> 'invoice_no' else m.invoice_no end,
        invoice_date = case when r ? 'invoice_date' then (r ->> 'invoice_date')::date else m.invoice_date end,
        commission_type = case when r ? 'commission_type' then r ->> 'commission_type' else m.commission_type end,
        delivery_date = case when r ? 'delivery_date' then (r ->> 'delivery_date')::date else m.delivery_date end,
        stage = case when r ? 'stage' then r ->> 'stage' else m.stage end,
        latest_update = case when r ? 'latest_update' then r ->> 'latest_update' else m.latest_update end
      where m.id = mid;
      if not found then
        raise exception 'Only the MD, Purchasing or HR & Accounts can change an MOF.'
          using errcode = '42501';
      end if;

      new_sum := coalesce((r ->> 'contract_sum')::numeric, cur.contract_sum);
      if round(new_sum, 2) <> cur.contract_sum then
        perform public.update_mof_total(mid, new_sum, cur.vo_amount, 'Imported');
      end if;
      vo_change := round(coalesce((r ->> 'vo_amount')::numeric, cur.vo_amount), 2)
        - cur.vo_amount;
      vo_date := current_date;
    else
      insert into public.mofs (mof_no, loa_date, salesperson_id, second_salesperson_id,
        company_name, project_name, loa_no, quote_no, site_address, customer_contact,
        accounts_contact, scope, installer_name, contract_sum, retention_pct,
        invoice_no, invoice_date, commission_type, delivery_date, stage, latest_update)
      values (
        r ->> 'mof_no',
        (r ->> 'loa_date')::date,
        (r ->> 'salesperson_id')::uuid,
        (r ->> 'second_salesperson_id')::uuid,
        r ->> 'company_name',
        r ->> 'project_name',
        r ->> 'loa_no',
        r ->> 'quote_no',
        r ->> 'site_address',
        r ->> 'customer_contact',
        r ->> 'accounts_contact',
        r ->> 'scope',
        r ->> 'installer_name',
        (r ->> 'contract_sum')::numeric,
        (r ->> 'retention_pct')::numeric,
        r ->> 'invoice_no',
        (r ->> 'invoice_date')::date,
        r ->> 'commission_type',
        (r ->> 'delivery_date')::date,
        r ->> 'stage',
        r ->> 'latest_update'
      )
      returning id into mid;
      vo_change := round(coalesce((r ->> 'vo_amount')::numeric, 0), 2);
      vo_date := (r ->> 'loa_date')::date;
    end if;

    if vo_change <> 0 then
      insert into public.mof_variation_orders (mof_id, vo_no, confirmed_on, amount, description)
      select mid, 'VO' || (count(*) + 1), vo_date, vo_change, 'Imported'
      from public.mof_variation_orders v
      where v.mof_id = mid;
    end if;

    if r ? 'lines' then
      delete from public.mof_lines l where l.mof_id = mid;
      insert into public.mof_lines (mof_id, product, stock_type, supplier, qty, unit, area_m2)
      select mid, line ->> 'product', line ->> 'stock_type', line ->> 'supplier',
        (line ->> 'qty')::numeric, line ->> 'unit', (line ->> 'area_m2')::numeric
      from jsonb_array_elements(r -> 'lines') as line;
    end if;

    if r ? 'cost' then
      update public.mof_costs c set cost = (r ->> 'cost')::numeric where c.mof_id = mid;
      if not found then
        insert into public.mof_costs (mof_id, cost) values (mid, (r ->> 'cost')::numeric);
      end if;
    end if;
  end loop;
end;
$$;

-- Commission now reads the MOF cost with its VOs' costs; otherwise as before.
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
  left join public.mof_cost_totals costs on costs.mof_id = mofs.id
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
    left join public.mof_cost_totals costs on costs.mof_id = mofs.id
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
