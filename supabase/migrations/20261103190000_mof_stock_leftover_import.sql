-- Paste-from-sheet import of MOFs (with product lines), stock items and leftover (loop 03 D5).
-- Like import_companies: security invoker, so every row goes through the caller's grants and
-- RLS, and one call is one transaction. The app validates rows first; an update row carries
-- "id" and only the columns that were pasted, so absent keys keep the saved value.

-- A MOF's contract sum and VO are not updatable columns. A changed total goes through
-- update_mof_total, which checks the role and records the reason "Imported".
-- "lines", when present, replaces the MOF's product lines. "cost" (managers only, by RLS)
-- sets the MOF's cost.
create function public.import_mofs(import_rows jsonb)
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
  new_vo numeric;
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
      new_vo := coalesce((r ->> 'vo_amount')::numeric, cur.vo_amount);
      if new_sum <> cur.contract_sum or new_vo <> cur.vo_amount then
        perform public.update_mof_total(mid, new_sum, new_vo, 'Imported');
      end if;
    else
      insert into public.mofs (mof_no, loa_date, salesperson_id, second_salesperson_id,
        company_name, project_name, loa_no, quote_no, site_address, customer_contact,
        accounts_contact, scope, installer_name, contract_sum, vo_amount, retention_pct,
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
        (r ->> 'vo_amount')::numeric,
        (r ->> 'retention_pct')::numeric,
        r ->> 'invoice_no',
        (r ->> 'invoice_date')::date,
        r ->> 'commission_type',
        (r ->> 'delivery_date')::date,
        r ->> 'stage',
        r ->> 'latest_update'
      )
      returning id into mid;
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

revoke execute on function public.import_mofs(jsonb) from public, anon;
grant execute on function public.import_mofs(jsonb) to authenticated;

-- The unit is fixed once reservations count in it, so an update never carries it.
create function public.import_stock_items(import_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
begin
  for r in select value from jsonb_array_elements(import_rows) loop
    if r ? 'id' then
      update public.stock_items s set
        supplier = case when r ? 'supplier' then r ->> 'supplier' else s.supplier end,
        collection = case when r ? 'collection' then r ->> 'collection' else s.collection end,
        qty = case when r ? 'qty' then (r ->> 'qty')::numeric else s.qty end
      where s.id = (r ->> 'id')::uuid;
      if not found then
        raise exception 'Stock item % could not be updated.', r ->> 'id';
      end if;
    else
      insert into public.stock_items (sku, supplier, collection, qty, unit)
      values (
        r ->> 'sku',
        r ->> 'supplier',
        r ->> 'collection',
        (r ->> 'qty')::numeric,
        r ->> 'unit'
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.import_stock_items(jsonb) from public, anon;
grant execute on function public.import_stock_items(jsonb) to authenticated;

-- Leftover is only added: a pasted item waits for pickup, like one recorded by hand.
create function public.import_leftovers(import_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
begin
  for r in select value from jsonb_array_elements(import_rows) loop
    insert into public.leftovers (mof_id, item, qty, unit, condition, destination, status, note)
    values (
      (r ->> 'mof_id')::uuid,
      r ->> 'item',
      (r ->> 'qty')::numeric,
      r ->> 'unit',
      r ->> 'condition',
      r ->> 'destination',
      'pending_pickup',
      r ->> 'note'
    );
  end loop;
end;
$$;

revoke execute on function public.import_leftovers(jsonb) from public, anon;
grant execute on function public.import_leftovers(jsonb) to authenticated;
