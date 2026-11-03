-- Registering or changing an MOF in one transaction (loop 05 finding 14, loop 07 D5). The app
-- used to write the MOF, its lines, the order total and the cost one by one, so a failure
-- part-way kept the earlier writes. Security invoker: every write still goes through the
-- caller's grants, RLS and triggers, and the order total still changes only through
-- update_mof_total.
--
-- mof_id is null for a new MOF. mof holds the mofs columns the form sets (contract_sum and
-- vo_amount included). lines is the full list of product lines: one with an "id" keeps and
-- changes that saved line, one without is added, and saved lines not listed are removed.
-- reason is needed only when the order total of an existing MOF changes. cost is null to
-- leave the cost alone.
create function public.save_mof(
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
    insert into public.mofs (mof_no, loa_date, salesperson_id, second_salesperson_id,
      project_id, company_name, project_name, loa_no, quote_no, site_address,
      site_contact_name, site_contact_mobile, office_pic_id, customer_contact,
      accounts_contact, scope, installer_name, contract_sum, vo_amount, retention_pct,
      invoice_no, invoice_date, commission_type, delivery_date, stage, latest_update,
      payment_checked, approvals_in_writing, artwork_signed_off, dos_pre_approved)
    values (posted.mof_no, posted.loa_date, posted.salesperson_id,
      posted.second_salesperson_id, posted.project_id, posted.company_name,
      posted.project_name, posted.loa_no, posted.quote_no, posted.site_address,
      posted.site_contact_name, posted.site_contact_mobile, posted.office_pic_id,
      posted.customer_contact, posted.accounts_contact, posted.scope, posted.installer_name,
      posted.contract_sum, posted.vo_amount, posted.retention_pct, posted.invoice_no,
      posted.invoice_date, posted.commission_type, posted.delivery_date, posted.stage,
      posted.latest_update, posted.payment_checked, posted.approvals_in_writing,
      posted.artwork_signed_off, posted.dos_pre_approved)
    returning id into mid;
  else
    select * into saved from public.mofs m where m.id = mid;
    if not found then
      raise exception 'MOF not found.' using errcode = 'P0002';
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

  if saved.id is not null
    and (round(posted.contract_sum, 2) <> saved.contract_sum
      or round(posted.vo_amount, 2) <> saved.vo_amount) then
    perform public.update_mof_total(mid, posted.contract_sum, posted.vo_amount,
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

revoke execute on function public.save_mof(uuid, jsonb, jsonb, text, numeric)
  from public, anon;
grant execute on function public.save_mof(uuid, jsonb, jsonb, text, numeric)
  to authenticated;
