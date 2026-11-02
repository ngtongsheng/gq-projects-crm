-- Order register (MOF, loop 03 task 12). Everyone signed in reads MOFs and their product
-- lines; salespeople see their own as "My Sales" by filtering in the app. The MD,
-- Purchasing and HR & Accounts keep the register. Cost sits in its own table that only
-- managers read (D12). The order total (contract sum + VO) changes only through
-- update_mof_total, which records the reason. Nothing is deleted except product lines
-- while an MOF is being edited.

create table public.mofs (
  id uuid primary key default gen_random_uuid(),
  mof_no text not null unique
    check (mof_no = upper(btrim(mof_no)) and mof_no <> ''),
  loa_date date not null,
  salesperson_id uuid not null references public.profiles (id),
  second_salesperson_id uuid references public.profiles (id)
    check (second_salesperson_id is distinct from salesperson_id),
  project_id uuid unique references public.projects (id),
  company_name text not null check (company_name = btrim(company_name) and company_name <> ''),
  project_name text not null check (project_name = btrim(project_name) and project_name <> ''),
  loa_no text,
  quote_no text,
  site_address text,
  site_contact_name text,
  site_contact_mobile text,
  office_pic_id uuid references public.profiles (id),
  customer_contact text,
  accounts_contact text,
  scope text not null default 's_and_l' check (scope in ('s_and_l', 'supply', 'labour')),
  installer_name text,
  contract_sum numeric(14,2) not null check (contract_sum > 0),
  -- Negative for an omission or credit note.
  vo_amount numeric(14,2) not null default 0,
  retention_pct numeric(5,2) not null default 0 check (retention_pct between 0 and 100),
  invoice_no text,
  invoice_date date,
  commission_type text not null default 'own'
    check (commission_type in ('own', 'pass_down', 'company')),
  delivery_date date,
  stage text not null default 'pending_order'
    check (stage in ('pending_order', 'ordered', 'in_production', 'shipping',
      'arrived_warehouse', 'pending_delivery', 'delivered_installing',
      'completed_payment_pending', 'closed', 'on_hold', 'cancelled')),
  latest_update text,
  payment_checked boolean not null default false,
  approvals_in_writing boolean not null default false,
  artwork_signed_off boolean not null default false,
  dos_pre_approved boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  check (contract_sum + vo_amount > 0)
);

create index mofs_salesperson_id_idx on public.mofs (salesperson_id);
create index mofs_second_salesperson_id_idx on public.mofs (second_salesperson_id);
create index mofs_stage_idx on public.mofs (stage);

create function public.touch_mof()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_mof() from public, anon, authenticated;

create trigger on_mof_written
  before update on public.mofs
  for each row execute function public.touch_mof();

alter table public.mofs enable row level security;

-- contract_sum and vo_amount are set on insert and afterwards only by update_mof_total.
revoke all on table public.mofs from anon, authenticated;
grant select on table public.mofs to authenticated;
grant insert (mof_no, loa_date, salesperson_id, second_salesperson_id, project_id,
  company_name, project_name, loa_no, quote_no, site_address, site_contact_name,
  site_contact_mobile, office_pic_id, customer_contact, accounts_contact, scope,
  installer_name, contract_sum, vo_amount, retention_pct, invoice_no, invoice_date,
  commission_type, delivery_date, stage, latest_update, payment_checked,
  approvals_in_writing, artwork_signed_off, dos_pre_approved)
  on table public.mofs to authenticated;
grant update (mof_no, loa_date, salesperson_id, second_salesperson_id, project_id,
  company_name, project_name, loa_no, quote_no, site_address, site_contact_name,
  site_contact_mobile, office_pic_id, customer_contact, accounts_contact, scope,
  installer_name, retention_pct, invoice_no, invoice_date, commission_type,
  delivery_date, stage, latest_update, payment_checked, approvals_in_writing,
  artwork_signed_off, dos_pre_approved)
  on table public.mofs to authenticated;

create policy "mofs: read all"
  on public.mofs for select
  to authenticated
  using (true);

create policy "mofs: register editors add"
  on public.mofs for insert
  to authenticated
  with check ((select public.has_job_role('md', 'support', 'accounts')));

create policy "mofs: register editors edit"
  on public.mofs for update
  to authenticated
  using ((select public.has_job_role('md', 'support', 'accounts')))
  with check ((select public.has_job_role('md', 'support', 'accounts')));

-- One row per product on an MOF. area_m2 is the line's area in square metres: worked out
-- from qty for m2 and sqft lines, keyed in for rolls and pieces.
create table public.mof_lines (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  product text not null check (product = btrim(product) and product <> ''),
  stock_type text not null check (stock_type in ('stock', 'indent', 'custom')),
  supplier text,
  qty numeric(12,2) not null default 0 check (qty >= 0),
  unit text not null default 'm2' check (unit in ('sqft', 'm2', 'roll', 'pcs')),
  area_m2 numeric(12,2) not null default 0 check (area_m2 >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create index mof_lines_mof_id_idx on public.mof_lines (mof_id);

alter table public.mof_lines enable row level security;

revoke all on table public.mof_lines from anon, authenticated;
grant select, delete on table public.mof_lines to authenticated;
grant insert (mof_id, product, stock_type, supplier, qty, unit, area_m2)
  on table public.mof_lines to authenticated;
grant update (product, stock_type, supplier, qty, unit, area_m2)
  on table public.mof_lines to authenticated;

create policy "mof lines: read all"
  on public.mof_lines for select
  to authenticated
  using (true);

create policy "mof lines: register editors add"
  on public.mof_lines for insert
  to authenticated
  with check ((select public.has_job_role('md', 'support', 'accounts')));

create policy "mof lines: register editors edit"
  on public.mof_lines for update
  to authenticated
  using ((select public.has_job_role('md', 'support', 'accounts')))
  with check ((select public.has_job_role('md', 'support', 'accounts')));

create policy "mof lines: register editors remove"
  on public.mof_lines for delete
  to authenticated
  using ((select public.has_job_role('md', 'support', 'accounts')));

-- Internal cost of an MOF. Only managers (MD, Sales Director, HR & Accounts) see or set it.
create table public.mof_costs (
  mof_id uuid primary key references public.mofs (id),
  cost numeric(14,2) not null check (cost >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

alter table public.mof_costs enable row level security;

revoke all on table public.mof_costs from anon, authenticated;
grant select on table public.mof_costs to authenticated;
grant insert (mof_id, cost) on table public.mof_costs to authenticated;
grant update (cost) on table public.mof_costs to authenticated;

create policy "mof costs: managers read"
  on public.mof_costs for select
  to authenticated
  using ((select public.is_manager()));

create policy "mof costs: managers add"
  on public.mof_costs for insert
  to authenticated
  with check ((select public.is_manager()));

create policy "mof costs: managers edit"
  on public.mof_costs for update
  to authenticated
  using ((select public.is_manager()))
  with check ((select public.is_manager()));

-- History of order total changes. Written only by update_mof_total.
create table public.mof_total_changes (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  old_total numeric(14,2) not null,
  new_total numeric(14,2) not null,
  reason text not null check (reason = btrim(reason) and reason <> ''),
  changed_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index mof_total_changes_mof_id_idx on public.mof_total_changes (mof_id);

alter table public.mof_total_changes enable row level security;

revoke all on table public.mof_total_changes from anon, authenticated;
grant select on table public.mof_total_changes to authenticated;

create policy "mof total changes: read all"
  on public.mof_total_changes for select
  to authenticated
  using (true);

-- Security definer because callers have no update grant on contract_sum and vo_amount:
-- this is the only way to change the order total, and it always records the reason.
create function public.update_mof_total(
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

  insert into public.mof_total_changes (mof_id, old_total, new_total, reason)
  values (
    current_mof.id,
    current_mof.contract_sum + current_mof.vo_amount,
    round(update_mof_total.contract_sum, 2) + round(update_mof_total.vo_amount, 2),
    btrim(update_mof_total.reason)
  );

  update public.mofs m
  set contract_sum = round(update_mof_total.contract_sum, 2),
    vo_amount = round(update_mof_total.vo_amount, 2)
  where m.id = current_mof.id;
end;
$$;

revoke execute on function public.update_mof_total(uuid, numeric, numeric, text)
  from public, anon;
grant execute on function public.update_mof_total(uuid, numeric, numeric, text)
  to authenticated;
