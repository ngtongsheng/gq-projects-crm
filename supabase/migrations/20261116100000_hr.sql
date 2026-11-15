-- Loop 16 task 01: HR (demo vHR). Company policies and the rules added after them, each
-- person's dated salary package, the standard packages for sales and site, the outstation
-- meal and hotel rates, and the sales grades J1-M2.
--
-- Who reads and writes: only the MD and HR & Accounts (loop 16 D1, demo "Only Vicky and
-- Jany"). The admin role alone grants nothing here, so salaries stay hidden from other admins.
-- View as runs as the viewed person, so it shows HR only to someone who could already see it.

-- The demo's ALLOW_TYPES, as stored keys; the app shows the labels.
create function public.is_allowance_list(items jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 20 then false
    else not exists (
      select 1 from jsonb_array_elements(items) as e (item)
      where case
        when jsonb_typeof(e.item) <> 'object' then true
        when e.item - 'name' - 'amount' <> '{}'::jsonb then true
        when jsonb_typeof(e.item -> 'amount') is distinct from 'number' then true
        when (e.item ->> 'amount')::numeric not between 0.01 and 100000 then true
        else (e.item ->> 'name') is null or (e.item ->> 'name') not in (
          'car', 'motor_car', 'office_parking', 'fixed', 'travel_car', 'phone', 'meal',
          'site', 'others'
        ) end
    ) end;
$$;

-- A policy document (demo hrDocs). Current or Older is not stored: a document is Older once
-- another one names it in replaces_id (D7). The PDF is in the attachments bucket under
-- hr-policies/<document-id>/, the same path shape as src/lib/storage/attachment-rules.ts.
create table public.hr_policy_documents (
  id uuid primary key default gen_random_uuid(),
  -- The demo's HR_CATS.
  category text not null
    check (category in ('commission_target', 'claims_expenses', 'leave', 'employment', 'others')),
  title text not null check (char_length(trim(title)) between 1 and 200),
  version text not null check (char_length(trim(version)) between 1 and 40),
  effective_on date not null,
  -- The Sales Target & Commission Scheme appendix: HR shows its summary and its version.
  is_commission_scheme boolean not null default false,
  file_path text unique
    check (char_length(file_path) <= 400 and starts_with(file_path, 'hr-policies/' || id::text || '/')),
  file_name text check (char_length(file_name) between 1 and 200),
  file_content_type text check (file_content_type = 'application/pdf'),
  file_uploaded_at timestamptz,
  link text check (char_length(link) <= 500 and link ~ '^https://[^[:space:]]+$'),
  replaces_id uuid unique references public.hr_policy_documents (id),
  note text not null default '' check (char_length(note) <= 500),
  added_by uuid not null default auth.uid() references public.profiles (id),
  added_at timestamptz not null default now(),
  check (
    (file_path is null) = (file_name is null)
    and (file_path is null) = (file_content_type is null)
    and (file_path is null) = (file_uploaded_at is null)
  ),
  check (file_path is null or link is null),
  check (replaces_id <> id)
);

-- Rules added after the appendix, until its next version (demo hrExtra).
create table public.hr_extra_rules (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  rule text not null check (char_length(trim(rule)) between 1 and 2000),
  added_by uuid not null default auth.uid() references public.profiles (id),
  added_at timestamptz not null default now()
);

-- The sales grades J1-M2 (demo HR_GRADES, D6). Basic starts empty: the demo leaves it to be
-- keyed in.
create table public.sales_grades (
  grade text primary key
    check (grade in ('J1', 'J2', 'J3', 'S1', 'S2', 'S3', 'SN1', 'SN2', 'SN3', 'M1', 'M2')),
  position smallint not null unique check (position between 1 and 11),
  basic numeric(10, 2) check (basic > 0),
  annual_target numeric(12, 2) not null check (annual_target >= 0),
  description text not null check (char_length(trim(description)) between 1 and 200)
);

insert into public.sales_grades (grade, position, annual_target, description) values
  ('J1', 1, 960000, 'Learning & Sales Support'),
  ('J2', 2, 1080000, 'Developing Sales'),
  ('J3', 3, 1200000, 'Independent Junior Sales'),
  ('S1', 4, 1440000, 'Independent Sales'),
  ('S2', 5, 1800000, 'Established Sales'),
  ('S3', 6, 1920000, 'Strong Sales Contributor'),
  ('SN1', 7, 2160000, 'Senior Sales'),
  ('SN2', 8, 2400000, 'Senior / Key Account'),
  ('SN3', 9, 3000000, 'Senior / Strategic Sales'),
  ('M1', 10, 3300000, 'Sales Management'),
  ('M2', 11, 3600000, 'Senior Sales Management');

-- What HR keeps on a person outside their dated packages (demo hrPkg and hrStaff): sales
-- grade, the signed appendix, confirmation, offer letter and notes.
create table public.staff_hr_records (
  profile_id uuid primary key references public.profiles (id),
  grade text references public.sales_grades (grade),
  appendix_signed_on date,
  appendix_version text check (char_length(appendix_version) between 1 and 40),
  confirmed_on date,
  offer_letter_link text
    check (char_length(offer_letter_link) <= 500 and offer_letter_link ~ '^https://[^[:space:]]+$'),
  note text not null default '' check (char_length(note) <= 500),
  check (appendix_version is null or appendix_signed_on is not null)
);

-- A person's package from a date (demo hrStaff hist, D4). A change is a new row, never an
-- edit, so the history stays. The package on a date is the latest row on or before it.
create table public.staff_packages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  effective_on date not null,
  basic numeric(10, 2) not null check (basic > 0),
  allowances jsonb not null default '[]' check (public.is_allowance_list(allowances)),
  -- Petrol + toll + parking claim max per month; empty uses the standard package's cap.
  claim_cap numeric(10, 2) check (claim_cap >= 0),
  -- Empty is automatic: directors, then grade M1/M2 as manager, else staff (demo hotelLvl).
  hotel_level text check (hotel_level in ('staff', 'manager', 'director')),
  reason text not null default '' check (char_length(reason) <= 200),
  added_by uuid not null default auth.uid() references public.profiles (id),
  added_at timestamptz not null default now(),
  unique (profile_id, effective_on)
);

-- The usual allowances and claim cap per position (demo STD_PKG0). Changing one does not
-- change packages already recorded.
create table public.standard_packages (
  position text primary key check (position in ('sales', 'site')),
  allowances jsonb not null default '[]' check (public.is_allowance_list(allowances)),
  claim_cap numeric(10, 2) check (claim_cap >= 0)
);

insert into public.standard_packages (position, allowances, claim_cap) values
  ('sales', '[{"name": "car", "amount": 300}, {"name": "office_parking", "amount": 100}]', 500),
  ('site', '[{"name": "motor_car", "amount": 300}]', 500);

-- Outstation rates (demo OS0): meals are a fixed allowance per day, hotel a budget per night
-- by level. One row.
create table public.outstation_rules (
  id boolean primary key default true check (id),
  breakfast numeric(8, 2) not null check (breakfast >= 0),
  lunch numeric(8, 2) not null check (lunch >= 0),
  dinner numeric(8, 2) not null check (dinner >= 0),
  hotel_staff numeric(8, 2) not null check (hotel_staff >= 0),
  hotel_manager numeric(8, 2) not null check (hotel_manager >= 0),
  hotel_director numeric(8, 2) not null check (hotel_director >= 0)
);

insert into public.outstation_rules (breakfast, lunch, dinner, hotel_staff, hotel_manager, hotel_director)
values (10, 15, 25, 100, 150, 180);

alter table public.hr_policy_documents enable row level security;
alter table public.hr_extra_rules enable row level security;
alter table public.sales_grades enable row level security;
alter table public.staff_hr_records enable row level security;
alter table public.staff_packages enable row level security;
alter table public.standard_packages enable row level security;
alter table public.outstation_rules enable row level security;

-- Documents and extra rules are added, edited and removed; seeded settings are only changed.
create policy "hr policy documents: md and accounts"
  on public.hr_policy_documents for all to authenticated
  using ((select public.has_job_role('md', 'accounts')))
  with check ((select public.has_job_role('md', 'accounts')));

create policy "hr policy documents: added as themselves"
  on public.hr_policy_documents as restrictive for insert to authenticated
  with check (added_by = (select auth.uid()));

create policy "hr extra rules: md and accounts"
  on public.hr_extra_rules for all to authenticated
  using ((select public.has_job_role('md', 'accounts')))
  with check ((select public.has_job_role('md', 'accounts')));

create policy "hr extra rules: added as themselves"
  on public.hr_extra_rules as restrictive for insert to authenticated
  with check (added_by = (select auth.uid()));

create policy "staff hr records: md and accounts"
  on public.staff_hr_records for all to authenticated
  using ((select public.has_job_role('md', 'accounts')))
  with check ((select public.has_job_role('md', 'accounts')));

-- D4: packages are read and added, never changed or removed.
create policy "staff packages: md and accounts read"
  on public.staff_packages for select to authenticated
  using ((select public.has_job_role('md', 'accounts')));

create policy "staff packages: md and accounts add"
  on public.staff_packages for insert to authenticated
  with check ((select public.has_job_role('md', 'accounts')) and added_by = (select auth.uid()));

create policy "sales grades: md and accounts read"
  on public.sales_grades for select to authenticated
  using ((select public.has_job_role('md', 'accounts')));

create policy "sales grades: md and accounts change"
  on public.sales_grades for update to authenticated
  using ((select public.has_job_role('md', 'accounts')))
  with check ((select public.has_job_role('md', 'accounts')));

create policy "standard packages: md and accounts read"
  on public.standard_packages for select to authenticated
  using ((select public.has_job_role('md', 'accounts')));

create policy "standard packages: md and accounts change"
  on public.standard_packages for update to authenticated
  using ((select public.has_job_role('md', 'accounts')))
  with check ((select public.has_job_role('md', 'accounts')));

create policy "outstation rules: md and accounts read"
  on public.outstation_rules for select to authenticated
  using ((select public.has_job_role('md', 'accounts')));

create policy "outstation rules: md and accounts change"
  on public.outstation_rules for update to authenticated
  using ((select public.has_job_role('md', 'accounts')))
  with check ((select public.has_job_role('md', 'accounts')));

-- Same rule as every table (loop 11): a person who has left reads and writes nothing.
create policy "left people: no access"
  on public.hr_policy_documents as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.hr_extra_rules as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.sales_grades as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.staff_hr_records as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.staff_packages as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.standard_packages as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.outstation_rules as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
