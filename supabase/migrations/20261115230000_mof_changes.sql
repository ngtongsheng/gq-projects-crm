-- Field-level MOF change history (loop 14 task 04, D5). Every MOF save records which of the
-- tracked fields changed, from what to what, by whom, with the reason. Order total changes
-- (update_mof_total and the VO list) keep writing mof_total_changes, which stays; a trigger
-- copies each new row here, and the rows already there are copied in once below.
--
-- Values are stored raw (amounts, ids, enum keys, dates) and labelled when shown; product lines
-- are stored as the one-line summary the app writes.
create table public.mof_changes (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  field text not null check (field in (
    'contract_sum', 'cost', 'installer_name', 'scope', 'salesperson_id',
    'second_salesperson_id', 'commission_type', 'loa_date', 'lines', 'order_total'
  )),
  old_value text,
  new_value text,
  reason text check (reason is null or (reason = btrim(reason) and reason <> '')),
  changed_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index mof_changes_mof_id_idx on public.mof_changes (mof_id);

alter table public.mof_changes enable row level security;

revoke all on table public.mof_changes from anon, authenticated;
grant select on table public.mof_changes to authenticated;
-- Who and when are filled in by the database, never posted.
grant insert (mof_id, field, old_value, new_value, reason)
  on table public.mof_changes to authenticated;

-- Team scoping as mof_total_changes; a cost row only for those who see the cost.
create policy "mof changes: read in team, cost for cost readers"
  on public.mof_changes for select
  to authenticated
  using (
    (field <> 'cost' or (select public.can_see_mof_cost()))
    and (
      not (select public.has_job_role('director', 'bd'))
      or public.mof_in_my_team(mof_id)
    )
  );

-- Written by save_mof (security invoker) for the register editors. Order total rows come only
-- from the copy trigger below.
create policy "mof changes: register editors add"
  on public.mof_changes for insert
  to authenticated
  with check (
    (select public.has_job_role('md', 'support', 'accounts'))
    and field <> 'order_total'
    and (field <> 'cost' or (select public.can_see_mof_cost()))
  );

insert into public.mof_changes (mof_id, field, old_value, new_value, reason, changed_by, created_at)
select c.mof_id, 'order_total', c.old_total::text, c.new_total::text, c.reason, c.changed_by,
  c.created_at
from public.mof_total_changes c;

create function public.copy_mof_total_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mof_changes (mof_id, field, old_value, new_value, reason, changed_by,
    created_at)
  values (new.mof_id, 'order_total', new.old_total::text, new.new_total::text, new.reason,
    new.changed_by, new.created_at);
  return null;
end;
$$;

revoke execute on function public.copy_mof_total_change() from public, anon, authenticated;

create trigger copy_to_mof_changes
  after insert on public.mof_total_changes
  for each row execute function public.copy_mof_total_change();

-- save_mof as before (variation orders), plus `changes`: the field changes the app worked out
-- for an existing MOF, each {field, old_value, new_value}, recorded with the reason. A change to
-- a completed job needs a reason.
drop function public.save_mof(uuid, jsonb, jsonb, text, numeric);

create function public.save_mof(
  mof_id uuid,
  mof jsonb,
  lines jsonb,
  reason text,
  cost numeric,
  changes jsonb default '[]'::jsonb
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
  why text := nullif(btrim(coalesce(save_mof.reason, '')), '');
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
    if saved.site_stage = 'completed' and why is null
      and jsonb_array_length(coalesce(save_mof.changes, '[]'::jsonb)) > 0 then
      raise exception 'This job is already completed. Write the reason for the change.'
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

  if saved.id is not null then
    insert into public.mof_changes (mof_id, field, old_value, new_value, reason)
    select mid, c.field, c.old_value, c.new_value, why
    from jsonb_to_recordset(coalesce(save_mof.changes, '[]'::jsonb))
      as c(field text, old_value text, new_value text);
  end if;

  return mid;
end;
$$;

revoke execute on function public.save_mof(uuid, jsonb, jsonb, text, numeric, jsonb)
  from public, anon;
grant execute on function public.save_mof(uuid, jsonb, jsonb, text, numeric, jsonb)
  to authenticated;
