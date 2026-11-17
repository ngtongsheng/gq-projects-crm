-- Loop 25 task 09: Marketing expense (demo vMkt, D5). The demo links records by name (vendor,
-- event, category); here they link by id, so a rename shows everywhere at once and a delete is
-- blocked by the foreign key while anything still uses the record.
--
-- Who (page `mkt` default, src/lib/auth/pages.ts):
--   readers   md, accounts, ssup, support, marketing
--   editors   the same minus accounts (HR & Accounts is read-only app-wide, isReadOnly)

create function public.reads_marketing()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_job_role('md', 'accounts', 'ssup', 'support', 'marketing');
$$;

revoke execute on function public.reads_marketing() from public, anon;
grant execute on function public.reads_marketing() to authenticated;

create function public.edits_marketing()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_job_role('md', 'ssup', 'support', 'marketing');
$$;

revoke execute on function public.edits_marketing() from public, anon;
grant execute on function public.edits_marketing() to authenticated;

-- Expense categories, in the order the dashboard lists them (demo MK_CAT0 and "Edit categories").
create table public.marketing_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and name <> '' and char_length(name) <= 100),
  sort_order integer not null default 0
);

create unique index marketing_categories_name_key on public.marketing_categories (lower(name));

insert into public.marketing_categories (name, sort_order) values
  ('Folder', 1),
  ('Full Piece Sample', 2),
  ('Wallpaper Book', 3),
  ('Printing & Stationery', 4),
  ('Graphic Design & Branding', 5),
  ('Digital Marketing', 6),
  ('Logistics & Courier', 7),
  ('Events & Exhibitions', 8),
  ('Wallpaper Design', 9),
  ('Merchandise & Gifts', 10),
  ('Others', 11);

-- A company the team buys from, or a part-timer paid through the expense log (demo 2.4).
create table public.marketing_vendors (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'company' check (kind in ('company', 'part_timer')),
  name text not null check (name = btrim(name) and name <> '' and char_length(name) <= 200),
  -- What a company supplies (demo MK_VTYPE).
  supplies text check (supplies in (
    'samples_catalogues', 'folders_sample_boards', 'printing', 'design_branding',
    'digital_marketing', 'courier_logistics', 'events', 'merchandise', 'others'
  )),
  contact_person text
    check (contact_person = btrim(contact_person) and contact_person <> ''
      and char_length(contact_person) <= 200),
  -- A part-timer's skills (demo MK_SKILL).
  skills text[] not null default '{}' check (skills <@ array[
    'graphic_design', 'video_shooting', 'video_editing', 'photography', 'social_media',
    'copywriting', 'others'
  ]),
  rate text check (rate = btrim(rate) and rate <> '' and char_length(rate) <= 200),
  portfolio_url text check (portfolio_url ~ '^https?://' and char_length(portfolio_url) <= 500),
  phone text check (phone = btrim(phone) and phone <> '' and char_length(phone) <= 40),
  email text check (email = btrim(email) and email ~ '^[^@\s]+@[^@\s]+$' and char_length(email) <= 200),
  notes text check (notes = btrim(notes) and notes <> '' and char_length(notes) <= 1000),
  -- Prepaid account: warn when the balance is below this; 0 is off (demo preAlert).
  low_balance_alert numeric(12, 2) not null default 0 check (low_balance_alert >= 0),
  -- Demo: a part-timer needs a way to be reached.
  check (kind <> 'part_timer' or phone is not null or email is not null)
);

create unique index marketing_vendors_name_key on public.marketing_vendors (lower(name));

-- An event with its own costing sheet (demo 2.5).
create table public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and name <> '' and char_length(name) <= 200),
  starts_on date,
  ends_on date,
  venue text check (venue = btrim(venue) and venue <> '' and char_length(venue) <= 200),
  budget numeric(12, 2) check (budget >= 0),
  notes text check (notes = btrim(notes) and notes <> '' and char_length(notes) <= 1000),
  check (ends_on >= starts_on)
);

create unique index marketing_events_name_key on public.marketing_events (lower(name));

-- One line of an event costing sheet (demo M.evt).
create table public.marketing_event_costs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.marketing_events (id),
  cost_group text not null
    check (cost_group = btrim(cost_group) and cost_group <> '' and char_length(cost_group) <= 100),
  description text
    check (description = btrim(description) and description <> '' and char_length(description) <= 300),
  supplier_ref text
    check (supplier_ref = btrim(supplier_ref) and supplier_ref <> '' and char_length(supplier_ref) <= 200),
  -- Free text like "RMB 2700".
  foreign_amount text
    check (foreign_amount = btrim(foreign_amount) and foreign_amount <> ''
      and char_length(foreign_amount) <= 100),
  rate numeric(12, 2) not null,
  unit text not null default 'ls'
    check (unit = btrim(unit) and unit <> '' and char_length(unit) <= 20),
  qty numeric(12, 2) not null default 1 check (qty > 0),
  total numeric(12, 2) not null generated always as (round(rate * qty, 2)) stored,
  remarks text check (remarks = btrim(remarks) and remarks <> '' and char_length(remarks) <= 1000),
  created_at timestamptz not null default now()
);

create index marketing_event_costs_event_idx on public.marketing_event_costs (event_id);

-- The expense log (demo 2.1).
create table public.marketing_expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  category_id uuid not null references public.marketing_categories (id),
  description text not null
    check (description = btrim(description) and description <> '' and char_length(description) <= 300),
  vendor_id uuid not null references public.marketing_vendors (id),
  invoice_ref text
    check (invoice_ref = btrim(invoice_ref) and invoice_ref <> '' and char_length(invoice_ref) <= 100),
  currency text not null default 'RM' check (currency in ('RM', 'USD', 'RMB', 'EUR', 'SGD', 'other')),
  amount numeric(12, 2) not null check (amount > 0),
  amount_rm numeric(12, 2) not null check (amount_rm > 0),
  event_id uuid references public.marketing_events (id),
  payment_method text not null default 'bank_transfer' check (payment_method in (
    'bank_transfer', 'company_card', 'cash', 'prepaid', 'petty_cash', 'others'
  )),
  remarks text check (remarks = btrim(remarks) and remarks <> '' and char_length(remarks) <= 1000),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz,
  -- Demo: for RM the RM amount is the amount.
  check (currency <> 'RM' or amount_rm = amount)
);

create index marketing_expenses_spent_on_idx on public.marketing_expenses (spent_on);
create index marketing_expenses_category_idx on public.marketing_expenses (category_id);
create index marketing_expenses_vendor_idx on public.marketing_expenses (vendor_id);
create index marketing_expenses_event_idx on public.marketing_expenses (event_id);

create function public.stamp_marketing_expense()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke execute on function public.stamp_marketing_expense() from public, anon, authenticated;

create trigger stamp_marketing_expense
  before update on public.marketing_expenses
  for each row execute function public.stamp_marketing_expense();

-- Money paid ahead to a vendor (top-up) and each job taken from it (deduction), demo 2.6.
create table public.marketing_prepaid_entries (
  id uuid primary key default gen_random_uuid(),
  entry_on date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  vendor_id uuid not null references public.marketing_vendors (id),
  kind text not null check (kind in ('top_up', 'deduction')),
  -- The top-up's description, or the deduction's "Client - project".
  description text
    check (description = btrim(description) and description <> '' and char_length(description) <= 300),
  foreign_currency text check (foreign_currency in ('EUR', 'USD', 'RMB', 'SGD', 'RM')),
  foreign_amount numeric(12, 2) check (foreign_amount > 0),
  amount_rm numeric(12, 2) not null check (amount_rm > 0),
  mof_ref text check (mof_ref = btrim(mof_ref) and mof_ref <> '' and char_length(mof_ref) <= 100),
  -- A marketing cost the client is not charged for (deductions only).
  marketing_foc boolean not null default false,
  remarks text check (remarks = btrim(remarks) and remarks <> '' and char_length(remarks) <= 1000),
  created_at timestamptz not null default now(),
  check (kind <> 'deduction' or description is not null),
  check (kind = 'deduction' or not marketing_foc),
  check ((foreign_currency is null) = (foreign_amount is null))
);

create index marketing_prepaid_entries_vendor_idx on public.marketing_prepaid_entries (vendor_id);

-- Each prepaid account's balance, worked out from its entries, never stored.
create view public.marketing_prepaid_balances
  with (security_invoker = true) as
  select
    v.id as vendor_id,
    coalesce(sum(e.amount_rm) filter (where e.kind = 'top_up'), 0)::numeric(12, 2) as topped_up,
    coalesce(sum(e.amount_rm) filter (where e.kind = 'deduction'), 0)::numeric(12, 2) as used,
    (coalesce(sum(e.amount_rm) filter (where e.kind = 'top_up'), 0)
      - coalesce(sum(e.amount_rm) filter (where e.kind = 'deduction'), 0))::numeric(12, 2) as balance,
    count(*) filter (where e.kind = 'deduction')::integer as jobs,
    coalesce(sum(e.amount_rm) filter (where e.kind = 'deduction' and e.marketing_foc), 0)::numeric(12, 2)
      as marketing_foc,
    max(e.entry_on) filter (where e.kind = 'top_up') as last_top_up_on,
    v.low_balance_alert,
    v.low_balance_alert > 0
      and coalesce(sum(e.amount_rm) filter (where e.kind = 'top_up'), 0)
        - coalesce(sum(e.amount_rm) filter (where e.kind = 'deduction'), 0) < v.low_balance_alert
      as low
  from public.marketing_vendors v
  join public.marketing_prepaid_entries e on e.vendor_id = v.id
  group by v.id;

-- Sample and catalogue give-away cost register (demo 2.7), not linked to Custom samples.
create table public.marketing_giveaways (
  id uuid primary key default gen_random_uuid(),
  given_on date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  -- Free text: the demo suggests earlier give-away suppliers, not the vendor list.
  supplier text check (supplier = btrim(supplier) and supplier <> '' and char_length(supplier) <= 200),
  invoice_no text
    check (invoice_no = btrim(invoice_no) and invoice_no <> '' and char_length(invoice_no) <= 100),
  item text not null check (item = btrim(item) and item <> '' and char_length(item) <= 300),
  -- Client or project; free text, suggested from contact companies.
  given_to text not null
    check (given_to = btrim(given_to) and given_to <> '' and char_length(given_to) <= 200),
  qty integer not null default 1 check (qty > 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  total numeric(12, 2) not null generated always as (round(qty * unit_cost, 2)) stored
);

alter table public.marketing_categories enable row level security;
alter table public.marketing_vendors enable row level security;
alter table public.marketing_events enable row level security;
alter table public.marketing_event_costs enable row level security;
alter table public.marketing_expenses enable row level security;
alter table public.marketing_prepaid_entries enable row level security;
alter table public.marketing_giveaways enable row level security;

revoke all on table public.marketing_categories from anon, authenticated;
revoke all on table public.marketing_vendors from anon, authenticated;
revoke all on table public.marketing_events from anon, authenticated;
revoke all on table public.marketing_event_costs from anon, authenticated;
revoke all on table public.marketing_expenses from anon, authenticated;
revoke all on table public.marketing_prepaid_entries from anon, authenticated;
revoke all on table public.marketing_giveaways from anon, authenticated;
revoke all on table public.marketing_prepaid_balances from anon, authenticated;

grant select, delete on table public.marketing_categories to authenticated;
grant insert (id, name, sort_order), update (name, sort_order)
  on table public.marketing_categories to authenticated;

grant select, delete on table public.marketing_vendors to authenticated;
grant insert (id, kind, name, supplies, contact_person, skills, rate, portfolio_url, phone, email,
    notes, low_balance_alert),
  update (kind, name, supplies, contact_person, skills, rate, portfolio_url, phone, email, notes,
    low_balance_alert)
  on table public.marketing_vendors to authenticated;

grant select, delete on table public.marketing_events to authenticated;
grant insert (id, name, starts_on, ends_on, venue, budget, notes),
  update (name, starts_on, ends_on, venue, budget, notes)
  on table public.marketing_events to authenticated;

grant select, delete on table public.marketing_event_costs to authenticated;
grant insert (id, event_id, cost_group, description, supplier_ref, foreign_amount, rate, unit, qty,
    remarks),
  update (event_id, cost_group, description, supplier_ref, foreign_amount, rate, unit, qty, remarks)
  on table public.marketing_event_costs to authenticated;

grant select, delete on table public.marketing_expenses to authenticated;
grant insert (id, spent_on, category_id, description, vendor_id, invoice_ref, currency, amount,
    amount_rm, event_id, payment_method, remarks),
  update (spent_on, category_id, description, vendor_id, invoice_ref, currency, amount, amount_rm,
    event_id, payment_method, remarks)
  on table public.marketing_expenses to authenticated;

grant select, delete on table public.marketing_prepaid_entries to authenticated;
grant insert (id, entry_on, vendor_id, kind, description, foreign_currency, foreign_amount,
    amount_rm, mof_ref, marketing_foc, remarks),
  update (entry_on, vendor_id, description, foreign_currency, foreign_amount, amount_rm, mof_ref,
    marketing_foc, remarks)
  on table public.marketing_prepaid_entries to authenticated;

grant select, delete on table public.marketing_giveaways to authenticated;
grant insert (id, given_on, supplier, invoice_no, item, given_to, qty, unit_cost),
  update (given_on, supplier, invoice_no, item, given_to, qty, unit_cost)
  on table public.marketing_giveaways to authenticated;

grant select on table public.marketing_prepaid_balances to authenticated;

-- Same rights on every marketing table: the page's readers read, its editors write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'marketing_categories', 'marketing_vendors', 'marketing_events', 'marketing_event_costs',
    'marketing_expenses', 'marketing_prepaid_entries', 'marketing_giveaways'
  ] loop
    execute format(
      'create policy "marketing: readers read" on public.%I for select to authenticated
         using ((select public.reads_marketing()))', t);
    execute format(
      'create policy "marketing: editors add" on public.%I for insert to authenticated
         with check ((select public.edits_marketing()))', t);
    execute format(
      'create policy "marketing: editors change" on public.%I for update to authenticated
         using ((select public.edits_marketing())) with check ((select public.edits_marketing()))', t);
    execute format(
      'create policy "marketing: editors delete" on public.%I for delete to authenticated
         using ((select public.edits_marketing()))', t);
    execute format(
      'create policy "left people: no access" on public.%I as restrictive for all to authenticated
         using ((select public.is_active())) with check ((select public.is_active()))', t);
  end loop;
end;
$$;
