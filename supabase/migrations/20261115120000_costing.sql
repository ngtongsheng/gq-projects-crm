-- Loop 13 task 02: Costing. A quote has revisions (Original, R1, R2...), each with options
-- (A, B, C) of item lines, and a history of what happened to it. FOB enquiries are the
-- purchasing desk's price replies. All maths stays in src/lib/domain/costing.ts (loop 13 D2).
--
-- Who reads (demo GQC canView): the salesperson who owns the quote; a Marketing Director their
-- team's; the MD, Sales Director, Purchasing and HR & Accounts everyone's. Nobody else.
-- Who writes: only the owner edits, and only while a revision is draft, submitted or returned.
-- The MD and Sales Director approve or return a submitted revision.

-- Loop 13 D6: costing settings. The editing screen comes later.
alter table public.app_settings
  add constraint app_settings_costing_pct_check
  check (case
    when key not in ('costing_min_margin_pct', 'costing_sst_pct') then true
    when jsonb_typeof(value) <> 'number' then false
    else (value #>> '{}')::numeric between 0 and 100 end);

insert into public.app_settings (key, value) values
  ('costing_min_margin_pct', '30'),
  ('costing_sst_pct', '10');

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  -- The salesperson's own quotation number, as the demo normalises it (normNo). "-R<n>" names a
  -- revision, so a base number never ends in it; the reserved words are the demo's page names.
  quote_no text not null unique
    check (quote_no ~ '^[A-Z0-9_.-]+$'
      and quote_no !~ '-R[0-9]+$'
      and quote_no not in ('REGISTER', 'NEW', 'APPROVAL', 'ENQUIRY', 'TEAM')),
  project_id uuid references public.projects (id),
  project_name text not null check (project_name = btrim(project_name)),
  customer_name text not null check (customer_name = btrim(customer_name)),
  salesperson_id uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_salesperson_id_idx on public.quotes (salesperson_id);
create index quotes_project_id_idx on public.quotes (project_id);

create table public.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  -- 0 is the Original, 1 is R1.
  rev integer not null check (rev >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'returned')),
  -- RM per unit of foreign currency; the demo's newRev defaults.
  fx_usd numeric(10,4) not null default 4.5 check (fx_usd > 0),
  fx_rmb numeric(10,4) not null default 0.6024 check (fx_rmb > 0),
  -- Filled from the costing_sst_pct setting when left out (guard below).
  sst_pct numeric(5,2) not null check (sst_pct between 0 and 100),
  target_margin_pct numeric(5,2) not null default 30 check (target_margin_pct between 0 and 100),
  -- The option the customer took; set only once the revision is OK to quote.
  chosen_option_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, rev),
  check (chosen_option_id is null or status = 'approved')
);

create table public.quote_options (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.quote_revisions (id) on delete cascade,
  key text not null check (key ~ '^[A-Z]$'),
  label text not null default '',
  unique (revision_id, key),
  -- Lets a revision's chosen option be checked to belong to that revision.
  unique (revision_id, id)
);

alter table public.quote_revisions
  add constraint quote_revisions_chosen_option_fkey
  foreign key (id, chosen_option_id)
  references public.quote_options (revision_id, id);

create table public.quote_revision_history (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.quote_revisions (id) on delete cascade,
  action text not null
    check (action in ('created', 'edited', 'revised', 'submitted', 'approved', 'returned', 'chosen')),
  note text not null default '',
  by_id uuid not null default auth.uid() references public.profiles (id),
  at timestamptz not null default now()
);

create index quote_revision_history_revision_id_idx
  on public.quote_revision_history (revision_id);

-- One line of an option. Category is what the client sees; type picks the cost formula in
-- costing.ts. Each type keeps only its own cost columns (the check at the end), so a line
-- cannot carry a stray cost from another formula. Supply-only is the 'supply' category.
create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.quote_options (id) on delete cascade,
  position integer not null check (position >= 0),
  category text not null
    check (category in ('supply', 'si', 'install', 'transport', 'acc', 'sl', 'labour', 'disc')),
  type text not null
    check (type in ('local', 'import', 'rug', 'labour', 'simple', 'lump', 'discount')),
  area text,
  product text,
  supplier text,
  description text,
  remark text,
  unit text not null default 'm2'
    check (unit in ('m2', 'sqft', 'pc', 'm', 'set', 'lot', 'trip', 'day', 'ls')),
  qty numeric(14,3) check (qty >= 0),
  -- Sell price per unit; a discount's rate is the amount taken off.
  rate numeric(14,4) check (rate >= 0),
  material numeric(14,4) check (material >= 0),
  wastage_pct numeric(5,2) check (wastage_pct between 0 and 100),
  underlay numeric(14,4) check (underlay >= 0),
  accessories numeric(14,4) check (accessories >= 0),
  install numeric(14,4) check (install >= 0),
  currency text check (currency in ('USD', 'RMB')),
  fob numeric(14,4) check (fob >= 0),
  fx numeric(10,4) check (fx >= 0),
  sst_pct numeric(5,2) check (sst_pct between 0 and 100),
  shipping numeric(14,4) check (shipping >= 0),
  rug_mode text check (rug_mode in ('area', 'piece')),
  length numeric(10,3) check (length >= 0),
  width numeric(10,3) check (width >= 0),
  piece_cost numeric(14,4) check (piece_cost >= 0),
  edging numeric(14,4) check (edging >= 0),
  cost numeric(14,4) check (cost >= 0),
  -- An installation line can follow the qty of the item it installs (demo "link").
  linked_item_id uuid references public.quote_items (id) on delete set null,
  check (case type
    when 'local' then category in ('supply', 'si')
      and num_nonnulls(currency, fob, fx, sst_pct, shipping, rug_mode, length, width,
        piece_cost, edging, cost, linked_item_id) = 0
    when 'import' then category in ('supply', 'si')
      and num_nonnulls(material, accessories, rug_mode, length, width, piece_cost, edging,
        cost, linked_item_id) = 0
    when 'rug' then category in ('supply', 'si') and rug_mode is not null
      and num_nonnulls(material, underlay, accessories, cost, linked_item_id) = 0
    when 'labour' then category = 'install'
      and num_nonnulls(material, wastage_pct, currency, fob, fx, sst_pct, shipping, rug_mode,
        length, width, piece_cost, edging, cost) = 0
    when 'simple' then category in ('acc', 'sl', 'labour')
      and num_nonnulls(wastage_pct, underlay, accessories, currency, fob, fx, sst_pct,
        shipping, rug_mode, length, width, piece_cost, edging, cost, linked_item_id) = 0
    when 'lump' then category = 'transport'
      and num_nonnulls(material, wastage_pct, underlay, accessories, install, currency, fob,
        fx, sst_pct, shipping, rug_mode, length, width, piece_cost, edging,
        linked_item_id) = 0
    when 'discount' then category = 'disc'
      and num_nonnulls(material, wastage_pct, underlay, accessories, install, currency, fob,
        fx, sst_pct, shipping, rug_mode, length, width, piece_cost, edging, cost,
        linked_item_id) = 0
  end)
);

create index quote_items_option_id_idx on public.quote_items (option_id);
create index quote_items_linked_item_id_idx on public.quote_items (linked_item_id);

-- The purchasing desk's log of FOB prices asked for over WhatsApp. The quote number is free
-- text: sales often ask before the quote exists. Status follows the FOB, as in the demo.
create table public.fob_enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_date date not null default current_date,
  quote_no text check (quote_no ~ '^[A-Z0-9_.-]+$'),
  salesperson_id uuid references public.profiles (id),
  product text,
  -- The demo's size list ("L x W x pieces" per line) that adds up the m2.
  sizes text,
  qty numeric(14,3) check (qty >= 0),
  unit text not null default 'm2' check (unit in ('m2', 'sqft', 'pc', 'm')),
  supplier text,
  currency text not null default 'USD' check (currency in ('USD', 'RMB')),
  fob numeric(14,4) check (fob >= 0),
  fx numeric(10,4) check (fx >= 0),
  shipping numeric(14,4) check (shipping >= 0),
  notes text,
  status text not null generated always as
    (case when coalesce(fob, 0) > 0 then 'replied' else 'pending' end) stored,
  replied_by uuid references public.profiles (id),
  replied_at timestamptz,
  recorded_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fob_enquiries_salesperson_id_idx on public.fob_enquiries (salesperson_id);
create index fob_enquiries_quote_no_idx on public.fob_enquiries (quote_no);

-- Helpers for the policies. Security definer so a policy on one table can look at the parent
-- rows without that table's own policies getting in the way.
create function public.can_read_quote(quote uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quotes q
    where q.id = quote
      and (
        public.has_job_role('md', 'director', 'support', 'accounts')
        or (public.has_job_role('sales', 'bd') and public.in_my_team(q.salesperson_id))
      )
  );
$$;

create function public.owns_quote(quote uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quotes
    where id = quote and salesperson_id = (select auth.uid())
  ) and public.is_active();
$$;

create function public.can_read_revision(revision uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_read_quote(
    (select quote_id from public.quote_revisions where id = revision)
  );
$$;

create function public.can_read_option(option uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_read_revision(
    (select revision_id from public.quote_options where id = option)
  );
$$;

-- The owner edits a revision's options and items while it is draft, submitted or returned.
create function public.can_edit_revision(revision uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quote_revisions
    where id = revision
      and status in ('draft', 'submitted', 'returned')
      and public.owns_quote(quote_id)
  );
$$;

create function public.can_edit_option(option uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_edit_revision(
    (select revision_id from public.quote_options where id = option)
  );
$$;

-- Purchasing, HR & Accounts, the MD and the Sales Director work every enquiry (demo enq flag).
create function public.works_fob_enquiries()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_job_role('md', 'director', 'support', 'accounts');
$$;

revoke execute on function public.can_read_quote(uuid) from public, anon;
revoke execute on function public.owns_quote(uuid) from public, anon;
revoke execute on function public.can_read_revision(uuid) from public, anon;
revoke execute on function public.can_read_option(uuid) from public, anon;
revoke execute on function public.can_edit_revision(uuid) from public, anon;
revoke execute on function public.can_edit_option(uuid) from public, anon;
revoke execute on function public.works_fob_enquiries() from public, anon;
grant execute on function public.can_read_quote(uuid) to authenticated;
grant execute on function public.owns_quote(uuid) to authenticated;
grant execute on function public.can_read_revision(uuid) to authenticated;
grant execute on function public.can_read_option(uuid) to authenticated;
grant execute on function public.can_edit_revision(uuid) to authenticated;
grant execute on function public.can_edit_option(uuid) to authenticated;
grant execute on function public.works_fob_enquiries() to authenticated;

create function public.touch_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_quote() from public, anon, authenticated;

create trigger on_quote_written
  before update on public.quotes
  for each row execute function public.touch_quote();

-- The status flow RLS cannot express (demo bindActions). The owner submits, or confirms a
-- revision whose lowest margin meets the minimum; the app checks that margin (D2 keeps maths
-- out of SQL). The MD or Sales Director approves or returns a submitted revision and changes
-- nothing else. An approved revision is frozen except for the option the customer chose.
-- Skipped when there is no signed-in user (the service role, e.g. example data scripts).
create function public.guard_quote_revision_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_owner boolean;
  frozen constant text[] := array['status', 'chosen_option_id', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    if new.sst_pct is null then
      select (value #>> '{}')::numeric into new.sst_pct
      from public.app_settings where key = 'costing_sst_pct';
    end if;
    return new;
  end if;

  new.updated_at = now();
  if (select auth.uid()) is null then
    return new;
  end if;

  is_owner := public.owns_quote(new.quote_id);

  if new.status = old.status then
    if old.status = 'approved' then
      if not is_owner or (to_jsonb(new) - frozen) <> (to_jsonb(old) - frozen) then
        raise exception 'An approved costing cannot be changed. Open a new revision.'
          using errcode = '42501';
      end if;
    elsif not is_owner then
      raise exception 'Only the salesperson edits their costing.' using errcode = '42501';
    end if;
  elsif is_owner and old.status in ('draft', 'submitted', 'returned')
    and new.status in ('submitted', 'approved') then
    null;
  elsif (select public.has_job_role('md', 'director')) and old.status = 'submitted'
    and new.status in ('approved', 'returned') then
    if (to_jsonb(new) - frozen) <> (to_jsonb(old) - frozen) then
      raise exception 'Approving or returning a costing changes nothing else.'
        using errcode = '42501';
    end if;
  else
    raise exception 'A % costing cannot become %.', old.status, new.status
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_quote_revision_write() from public, anon, authenticated;

create trigger on_quote_revision_written
  before insert or update on public.quote_revisions
  for each row execute function public.guard_quote_revision_write();

-- Who replied is stamped from the signed-in person when the FOB is filled (demo stampReply).
create function public.stamp_fob_reply()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if coalesce(new.fob, 0) = 0 then
    new.replied_by = null;
    new.replied_at = null;
  elsif tg_op = 'INSERT' or coalesce(old.fob, 0) = 0 then
    new.replied_by = (select auth.uid());
    new.replied_at = now();
  else
    new.replied_by = old.replied_by;
    new.replied_at = old.replied_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_fob_reply() from public, anon, authenticated;

create trigger on_fob_enquiry_written
  before insert or update on public.fob_enquiries
  for each row execute function public.stamp_fob_reply();

alter table public.quotes enable row level security;
alter table public.quote_revisions enable row level security;
alter table public.quote_options enable row level security;
alter table public.quote_revision_history enable row level security;
alter table public.quote_items enable row level security;
alter table public.fob_enquiries enable row level security;

-- Column grants keep ids, parents and audit columns fixed after insert. Nothing in a quote is
-- deleted except the options and lines the owner removes while editing.
revoke all on table public.quotes from anon, authenticated;
grant select on table public.quotes to authenticated;
grant insert (quote_no, project_id, project_name, customer_name, salesperson_id)
  on table public.quotes to authenticated;
grant update (project_id, project_name, customer_name) on table public.quotes to authenticated;

revoke all on table public.quote_revisions from anon, authenticated;
grant select on table public.quote_revisions to authenticated;
grant insert (quote_id, rev, status, fx_usd, fx_rmb, sst_pct, target_margin_pct)
  on table public.quote_revisions to authenticated;
grant update (status, fx_usd, fx_rmb, sst_pct, target_margin_pct, chosen_option_id)
  on table public.quote_revisions to authenticated;

revoke all on table public.quote_options from anon, authenticated;
grant select, delete on table public.quote_options to authenticated;
grant insert (revision_id, key, label) on table public.quote_options to authenticated;
grant update (label) on table public.quote_options to authenticated;

revoke all on table public.quote_revision_history from anon, authenticated;
grant select on table public.quote_revision_history to authenticated;
grant insert (revision_id, action, note) on table public.quote_revision_history to authenticated;

revoke all on table public.quote_items from anon, authenticated;
grant select, delete on table public.quote_items to authenticated;
grant insert (option_id, position, category, type, area, product, supplier, description, remark,
  unit, qty, rate, material, wastage_pct, underlay, accessories, install, currency, fob, fx,
  sst_pct, shipping, rug_mode, length, width, piece_cost, edging, cost, linked_item_id)
  on table public.quote_items to authenticated;
grant update (position, category, type, area, product, supplier, description, remark, unit, qty,
  rate, material, wastage_pct, underlay, accessories, install, currency, fob, fx, sst_pct,
  shipping, rug_mode, length, width, piece_cost, edging, cost, linked_item_id)
  on table public.quote_items to authenticated;

revoke all on table public.fob_enquiries from anon, authenticated;
grant select, delete on table public.fob_enquiries to authenticated;
grant insert (enquiry_date, quote_no, salesperson_id, product, sizes, qty, unit, supplier,
  currency, fob, fx, shipping, notes)
  on table public.fob_enquiries to authenticated;
grant update (enquiry_date, quote_no, salesperson_id, product, sizes, qty, unit, supplier,
  currency, fob, fx, shipping, notes)
  on table public.fob_enquiries to authenticated;

create policy "quotes: owner, team lead and see-all roles read"
  on public.quotes for select
  to authenticated
  using (
    (select public.has_job_role('md', 'director', 'support', 'accounts'))
    or ((select public.has_job_role('sales', 'bd')) and public.in_my_team(salesperson_id))
  );

-- Anyone who sells starts their own quotes (demo: roles with the sales flag).
create policy "quotes: sellers add their own"
  on public.quotes for insert
  to authenticated
  with check (
    (select public.has_job_role('md', 'director', 'sales', 'bd'))
    and salesperson_id = (select auth.uid())
  );

create policy "quotes: owner edits"
  on public.quotes for update
  to authenticated
  using (salesperson_id = (select auth.uid()))
  with check (salesperson_id = (select auth.uid()));

create policy "quote revisions: quote readers read"
  on public.quote_revisions for select
  to authenticated
  using (public.can_read_quote(quote_id));

create policy "quote revisions: owner adds drafts"
  on public.quote_revisions for insert
  to authenticated
  with check (public.owns_quote(quote_id) and status = 'draft');

create policy "quote revisions: owner edits, md and director decide"
  on public.quote_revisions for update
  to authenticated
  using (public.owns_quote(quote_id) or (select public.has_job_role('md', 'director')))
  with check (public.owns_quote(quote_id) or (select public.has_job_role('md', 'director')));

create policy "quote options: quote readers read"
  on public.quote_options for select
  to authenticated
  using (public.can_read_revision(revision_id));

create policy "quote options: owner adds while editable"
  on public.quote_options for insert
  to authenticated
  with check (public.can_edit_revision(revision_id));

create policy "quote options: owner edits while editable"
  on public.quote_options for update
  to authenticated
  using (public.can_edit_revision(revision_id))
  with check (public.can_edit_revision(revision_id));

create policy "quote options: owner removes while editable"
  on public.quote_options for delete
  to authenticated
  using (public.can_edit_revision(revision_id));

create policy "quote history: quote readers read"
  on public.quote_revision_history for select
  to authenticated
  using (public.can_read_revision(revision_id));

create policy "quote history: owner, md and director add"
  on public.quote_revision_history for insert
  to authenticated
  with check (
    public.can_read_revision(revision_id)
    and (
      public.owns_quote((select quote_id from public.quote_revisions where id = revision_id))
      or (select public.has_job_role('md', 'director'))
    )
  );

create policy "quote items: quote readers read"
  on public.quote_items for select
  to authenticated
  using (public.can_read_option(option_id));

create policy "quote items: owner adds while editable"
  on public.quote_items for insert
  to authenticated
  with check (public.can_edit_option(option_id));

create policy "quote items: owner edits while editable"
  on public.quote_items for update
  to authenticated
  using (public.can_edit_option(option_id))
  with check (public.can_edit_option(option_id));

create policy "quote items: owner removes while editable"
  on public.quote_items for delete
  to authenticated
  using (public.can_edit_option(option_id));

-- Salespeople see and keep the enquiries for their own quotes (demo canEditEnq).
create policy "fob enquiries: enquiry desk and own salesperson read"
  on public.fob_enquiries for select
  to authenticated
  using (
    (select public.works_fob_enquiries())
    or ((select public.has_job_role('sales', 'bd')) and salesperson_id = (select auth.uid()))
  );

create policy "fob enquiries: enquiry desk and own salesperson add"
  on public.fob_enquiries for insert
  to authenticated
  with check (
    (select public.works_fob_enquiries())
    or ((select public.has_job_role('sales', 'bd')) and salesperson_id = (select auth.uid()))
  );

create policy "fob enquiries: enquiry desk and own salesperson edit"
  on public.fob_enquiries for update
  to authenticated
  using (
    (select public.works_fob_enquiries())
    or ((select public.has_job_role('sales', 'bd')) and salesperson_id = (select auth.uid()))
  )
  with check (
    (select public.works_fob_enquiries())
    or ((select public.has_job_role('sales', 'bd')) and salesperson_id = (select auth.uid()))
  );

create policy "fob enquiries: enquiry desk and own salesperson remove"
  on public.fob_enquiries for delete
  to authenticated
  using (
    (select public.works_fob_enquiries())
    or ((select public.has_job_role('sales', 'bd')) and salesperson_id = (select auth.uid()))
  );

create policy "left people: no access"
  on public.quotes as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.quote_revisions as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.quote_options as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.quote_revision_history as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.quote_items as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.fob_enquiries as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
