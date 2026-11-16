-- Loop 18 task 07 (D4): samples GQ keeps at the Best Link warehouse. One row per SKU with how
-- many are at Best Link, and a log of every move: quantity set (adjust), taken out (and maybe
-- back) or given to a client to keep. The quantity changes only through that log, so it always
-- matches the history. Best Link pickup forms are numbered SR-0001 like DO numbers (D2): next =
-- max(used, cancelled) + 1, a cancelled number is never reused, and saving a form takes its
-- samples out in the same transaction. New tables only: nothing stored changes.

-- Who edits samples: the people who arrange stock, HR & Accounts and Marketing (demo
-- smpCanEdit). Mirrors canEditSamples in src/lib/auth/job-role.ts.
create function public.can_edit_samples()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_edit_stock() or public.has_job_role('accounts', 'marketing');
$$;

revoke execute on function public.can_edit_samples() from public, anon;
grant execute on function public.can_edit_samples() to authenticated;

create table public.samples (
  id uuid primary key default gen_random_uuid(),
  -- Product group, e.g. Carpet Tile (list in src/lib/domain/samples.ts).
  product text not null check (product = btrim(product) and product <> ''),
  brand text check (brand is null or (brand = btrim(brand) and brand <> '')),
  sku text check (sku is null or (sku = upper(btrim(sku)) and sku <> '')),
  name text check (name is null or (name = btrim(name) and name <> '')),
  -- At Best Link now. Written only by the move log below.
  qty numeric(12,2) not null default 0 check (qty >= 0),
  unit text not null default 'pc'
    check (unit in ('pc', 'box', 'set', 'roll', 'sheet', 'm²', 'catalogue')),
  spec text check (spec is null or (spec = btrim(spec) and spec <> '')),
  notes text check (notes is null or (notes = btrim(notes) and notes <> '')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) default auth.uid(),
  check (sku is not null or name is not null)
);

-- One line per SKU and brand.
create unique index samples_brand_sku_key on public.samples (coalesce(brand, ''), sku)
  where sku is not null;

-- One row: the lowest number the next pickup form may take (locked while issuing, so two people
-- never get the same one), and the Best Link WhatsApp number and Drive folder for the forms.
create table public.sample_pickup_settings (
  id boolean primary key default true check (id),
  next_no integer not null default 1 check (next_no > 0),
  -- Digits without the plus, e.g. 60123723925.
  best_link_whatsapp text check (best_link_whatsapp ~ '^[0-9]{8,15}$'),
  drive_folder_url text check (drive_folder_url ~ '^https://\S+$')
);

insert into public.sample_pickup_settings (next_no) values (1);

-- Best Link pickup forms ("V-GQ SIGNATURE RECEIPT"), shown as SR- and 4 digits.
create table public.sample_pickups (
  id uuid primary key default gen_random_uuid(),
  running_no integer not null unique check (running_no > 0),
  form_date date not null default current_date,
  person_in_charge text not null check (person_in_charge = btrim(person_in_charge)
    and person_in_charge <> ''),
  contact text not null check (contact = btrim(contact) and contact <> ''),
  method text not null check (method in ('lalamove', 'self_pickup', 'transporter')),
  appointment_on date not null,
  driver_contact text check (driver_contact is null
    or (driver_contact = btrim(driver_contact) and driver_contact <> '')),
  vehicle_no text check (vehicle_no is null or (vehicle_no = btrim(vehicle_no) and vehicle_no <> '')),
  address text check (address is null or (address = btrim(address) and address <> '')),
  -- For our record, not printed: who takes the samples and for which client or project.
  taken_by uuid references public.profiles (id),
  for_whom text check (for_whom is null or (for_whom = btrim(for_whom) and for_whom <> '')),
  pdf_saved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

-- Up to 10 rows, as printed. A row naming a sample in the list takes it out of Best Link.
create table public.sample_pickup_lines (
  id uuid primary key default gen_random_uuid(),
  pickup_id uuid not null references public.sample_pickups (id) on delete cascade,
  position integer not null check (position between 1 and 10),
  sample_id uuid references public.samples (id) on delete set null,
  product_name text not null check (product_name = btrim(product_name) and product_name <> ''),
  spec text check (spec is null or (spec = btrim(spec) and spec <> '')),
  qty numeric(12,2) not null check (qty > 0),
  unit text not null check (unit in ('pc', 'box', 'set', 'roll', 'sheet', 'm²', 'catalogue')),
  remarks text check (remarks is null or (remarks = btrim(remarks) and remarks <> '')),
  unique (pickup_id, position)
);

create index sample_pickup_lines_sample_id_idx on public.sample_pickup_lines (sample_id);

-- Form numbers taken off a removed pickup form. Never reused.
create table public.cancelled_sample_pickup_numbers (
  running_no integer primary key check (running_no > 0),
  cancelled_at timestamptz not null default now(),
  cancelled_by uuid references public.profiles (id) default auth.uid()
);

-- adjust: the quantity was set to `qty` (counted, added, pasted). out: `qty` left Best Link and
-- may come back (`back_on`). kept: `qty` left for good, e.g. the client keeps it.
create table public.sample_moves (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples (id) on delete cascade,
  kind text not null check (kind in ('adjust', 'out', 'kept')),
  qty numeric(12,2) not null check (qty >= 0),
  -- At Best Link before this move; set by the database.
  qty_before numeric(12,2) not null,
  moved_on date not null default current_date,
  taken_by uuid references public.profiles (id),
  for_whom text check (for_whom is null or (for_whom = btrim(for_whom) and for_whom <> '')),
  pickup_id uuid references public.sample_pickups (id) on delete cascade,
  back_on date,
  back_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check (kind = 'adjust' or qty > 0),
  check (kind <> 'adjust' or (taken_by is null and for_whom is null)),
  check (pickup_id is null or kind = 'out'),
  check (back_on is null or (kind = 'out' and back_on >= moved_on)),
  check ((back_on is null) = (back_by is null))
);

create index sample_moves_sample_id_idx on public.sample_moves (sample_id);
create index sample_moves_pickup_id_idx on public.sample_moves (pickup_id);

alter table public.samples enable row level security;
alter table public.sample_pickup_settings enable row level security;
alter table public.sample_pickups enable row level security;
alter table public.sample_pickup_lines enable row level security;
alter table public.cancelled_sample_pickup_numbers enable row level security;
alter table public.sample_moves enable row level security;

revoke all on table public.samples from anon, authenticated;
revoke all on table public.sample_pickup_settings from anon, authenticated;
revoke all on table public.sample_pickups from anon, authenticated;
revoke all on table public.sample_pickup_lines from anon, authenticated;
revoke all on table public.cancelled_sample_pickup_numbers from anon, authenticated;
revoke all on table public.sample_moves from anon, authenticated;

grant select, delete on table public.samples to authenticated;
-- The quantity is set when the sample is added; later only through a move.
grant insert (product, brand, sku, name, qty, unit, spec, notes)
  on table public.samples to authenticated;
grant update (product, brand, sku, name, unit, spec, notes)
  on table public.samples to authenticated;

grant select on table public.sample_pickup_settings to authenticated;
grant update (best_link_whatsapp, drive_folder_url)
  on table public.sample_pickup_settings to authenticated;

-- Forms are added by save_sample_pickup only; their lines never change after saving.
grant select, delete on table public.sample_pickups to authenticated;
grant update (person_in_charge, contact, method, appointment_on, driver_contact, vehicle_no,
  address, taken_by, for_whom, pdf_saved_at) on table public.sample_pickups to authenticated;
grant select on table public.sample_pickup_lines to authenticated;
grant select on table public.cancelled_sample_pickup_numbers to authenticated;

grant select on table public.sample_moves to authenticated;
grant insert (sample_id, kind, qty, moved_on, taken_by, for_whom)
  on table public.sample_moves to authenticated;
-- "Back": the only change to a move.
grant update (back_on) on table public.sample_moves to authenticated;

create policy "samples: read all"
  on public.samples for select
  to authenticated
  using (true);

create policy "samples: editors add"
  on public.samples for insert
  to authenticated
  with check ((select public.can_edit_samples()));

create policy "samples: editors change"
  on public.samples for update
  to authenticated
  using ((select public.can_edit_samples()))
  with check ((select public.can_edit_samples()));

create policy "samples: editors remove"
  on public.samples for delete
  to authenticated
  using ((select public.can_edit_samples()));

create policy "sample pickup settings: read all"
  on public.sample_pickup_settings for select
  to authenticated
  using (true);

create policy "sample pickup settings: editors change"
  on public.sample_pickup_settings for update
  to authenticated
  using ((select public.can_edit_samples()))
  with check ((select public.can_edit_samples()));

create policy "sample pickups: read all"
  on public.sample_pickups for select
  to authenticated
  using (true);

create policy "sample pickups: editors change"
  on public.sample_pickups for update
  to authenticated
  using ((select public.can_edit_samples()))
  with check ((select public.can_edit_samples()));

create policy "sample pickups: editors remove"
  on public.sample_pickups for delete
  to authenticated
  using ((select public.can_edit_samples()));

create policy "sample pickup lines: read all"
  on public.sample_pickup_lines for select
  to authenticated
  using (true);

create policy "cancelled sample pickup numbers: read all"
  on public.cancelled_sample_pickup_numbers for select
  to authenticated
  using (true);

create policy "sample moves: read all"
  on public.sample_moves for select
  to authenticated
  using (true);

create policy "sample moves: editors add"
  on public.sample_moves for insert
  to authenticated
  with check ((select public.can_edit_samples()));

create policy "sample moves: editors mark back"
  on public.sample_moves for update
  to authenticated
  using ((select public.can_edit_samples()))
  with check ((select public.can_edit_samples()));

create policy "left people: no access"
  on public.samples as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.sample_pickup_settings as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.sample_pickups as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.sample_pickup_lines as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.cancelled_sample_pickup_numbers as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.sample_moves as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- "Updated" on the list: who last changed the sample, including through a move.
create function public.stamp_sample()
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

create trigger stamp_sample
  before update on public.samples
  for each row execute function public.stamp_sample();

revoke execute on function public.stamp_sample() from public, anon, authenticated;

-- A new sample starts its history with "Added". Security definer: the log is written by the
-- database, and qty_before is not a column people may set.
create function public.log_sample_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sample_moves (sample_id, kind, qty, qty_before)
  values (new.id, 'adjust', new.qty, 0);
  return null;
end;
$$;

create trigger log_sample_added
  after insert on public.samples
  for each row execute function public.log_sample_added();

revoke execute on function public.log_sample_added() from public, anon, authenticated;

-- Applies a move to the quantity at Best Link. The sample row is locked, so two moves at once
-- cannot both take the last one. Security definer: people cannot write the quantity directly.
create function public.apply_sample_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  at_best_link numeric;
  sample_unit text;
begin
  select qty, unit into at_best_link, sample_unit
  from public.samples where id = new.sample_id for update;
  if at_best_link is null then
    raise exception 'This sample is no longer in the list.' using errcode = '23503';
  end if;

  new.back_on := null;
  new.back_by := null;

  if new.kind = 'adjust' then
    -- Only log_sample_added passes qty_before (people cannot insert the column).
    new.qty_before := coalesce(new.qty_before, at_best_link);
    update public.samples set qty = new.qty where id = new.sample_id;
    return new;
  end if;

  new.qty_before := at_best_link;
  if new.qty > at_best_link then
    raise exception 'Only % % at Best Link.', trim_scale(at_best_link), sample_unit
      using errcode = '23514';
  end if;
  update public.samples set qty = qty - new.qty where id = new.sample_id;
  return new;
end;
$$;

create trigger apply_sample_move
  before insert on public.sample_moves
  for each row execute function public.apply_sample_move();

revoke execute on function public.apply_sample_move() from public, anon, authenticated;

-- "Back": a sample taken out returns to Best Link, once.
create function public.return_sample_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.kind <> 'out' or old.back_on is not null or new.back_on is null then
    raise exception 'Only a sample taken out can come back, once.' using errcode = '23514';
  end if;
  new.back_by := auth.uid();
  update public.samples set qty = qty + old.qty where id = old.sample_id;
  return new;
end;
$$;

create trigger return_sample_move
  before update on public.sample_moves
  for each row execute function public.return_sample_move();

revoke execute on function public.return_sample_move() from public, anon, authenticated;

-- A move that is still out when it goes (its pickup form was removed) returns its samples.
create function public.undo_sample_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.kind = 'out' and old.back_on is null then
    update public.samples set qty = qty + old.qty where id = old.sample_id;
  end if;
  return null;
end;
$$;

create trigger undo_sample_move
  after delete on public.sample_moves
  for each row execute function public.undo_sample_move();

revoke execute on function public.undo_sample_move() from public, anon, authenticated;

-- A removed pickup form's number is cancelled. Security definer: nobody writes the list directly.
create function public.cancel_sample_pickup_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cancelled_sample_pickup_numbers (running_no) values (old.running_no);
  return null;
end;
$$;

create trigger cancel_sample_pickup_number
  after delete on public.sample_pickups
  for each row execute function public.cancel_sample_pickup_number();

revoke execute on function public.cancel_sample_pickup_number() from public, anon, authenticated;

-- The highest form number used or cancelled, or 0 when there is none.
create function public.last_sample_pickup_number()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(running_no), 0) from (
    select running_no from public.sample_pickups
    union all
    select running_no from public.cancelled_sample_pickup_numbers
  ) numbers;
$$;

-- The number the next saved form gets.
create function public.next_sample_pickup_number()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(next_no, public.last_sample_pickup_number() + 1)
  from public.sample_pickup_settings;
$$;

revoke execute on function public.last_sample_pickup_number() from public, anon;
grant execute on function public.last_sample_pickup_number() to authenticated;
revoke execute on function public.next_sample_pickup_number() from public, anon;
grant execute on function public.next_sample_pickup_number() to authenticated;

-- "Next pickup form number": set once to continue from the last paper form. It must be higher
-- than every number used or cancelled.
create function public.set_next_sample_pickup_number(p_next_no integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_no integer;
begin
  if not (select public.can_edit_samples()) then
    raise exception 'Only the people who look after samples can set the next form no.'
      using errcode = '42501';
  end if;

  perform 1 from public.sample_pickup_settings for update;

  last_no := public.last_sample_pickup_number();
  if p_next_no is null or p_next_no <= last_no then
    raise exception 'The next form no. must be higher than the last number used (%).', last_no
      using errcode = '23514';
  end if;

  update public.sample_pickup_settings set next_no = p_next_no;
end;
$$;

revoke execute on function public.set_next_sample_pickup_number(integer) from public, anon;
grant execute on function public.set_next_sample_pickup_number(integer) to authenticated;

-- "Save" on the pickup form: numbers the form, saves its rows and takes every row that names a
-- sample out of Best Link, all or nothing. p_pickup holds the form fields; p_lines is an array of
-- {sample_id?, product_name, spec?, qty, unit, remarks?}. Returns the new form.
create function public.save_sample_pickup(p_pickup jsonb, p_lines jsonb)
returns table (pickup_id uuid, running_no integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  floor_no integer;
  issued integer;
  new_id uuid;
  line record;
  sample_unit text;
begin
  if not (select public.can_edit_samples()) then
    raise exception 'Only the people who look after samples can save a pickup form.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one item.' using errcode = '23514';
  end if;

  -- Held until the transaction ends: a second caller waits here and then sees this number used.
  select next_no into floor_no from public.sample_pickup_settings for update;
  issued := greatest(floor_no, public.last_sample_pickup_number() + 1);

  insert into public.sample_pickups (running_no, person_in_charge, contact, method,
    appointment_on, driver_contact, vehicle_no, address, taken_by, for_whom)
  values (
    issued,
    p_pickup ->> 'person_in_charge',
    p_pickup ->> 'contact',
    p_pickup ->> 'method',
    (p_pickup ->> 'appointment_on')::date,
    p_pickup ->> 'driver_contact',
    p_pickup ->> 'vehicle_no',
    p_pickup ->> 'address',
    (p_pickup ->> 'taken_by')::uuid,
    p_pickup ->> 'for_whom'
  )
  returning id into new_id;

  for line in
    select
      item.position::integer as position,
      (item.value ->> 'sample_id')::uuid as sample_id,
      item.value ->> 'product_name' as product_name,
      item.value ->> 'spec' as spec,
      (item.value ->> 'qty')::numeric as qty,
      item.value ->> 'unit' as unit,
      item.value ->> 'remarks' as remarks
    from jsonb_array_elements(p_lines) with ordinality as item (value, position)
  loop
    if line.sample_id is not null then
      select unit into sample_unit from public.samples where id = line.sample_id;
      if sample_unit is distinct from line.unit then
        raise exception 'Row %: this sample is counted in %.', line.position,
          coalesce(sample_unit, 'another unit')
          using errcode = '23514';
      end if;
    end if;

    insert into public.sample_pickup_lines
      (pickup_id, position, sample_id, product_name, spec, qty, unit, remarks)
    values (new_id, line.position, line.sample_id, line.product_name, line.spec, line.qty,
      line.unit, line.remarks);

    if line.sample_id is not null then
      insert into public.sample_moves (sample_id, kind, qty, taken_by, for_whom, pickup_id)
      values (line.sample_id, 'out', line.qty, (p_pickup ->> 'taken_by')::uuid,
        p_pickup ->> 'for_whom', new_id);
    end if;
  end loop;

  update public.sample_pickup_settings set next_no = issued + 1;

  return query select new_id, issued;
end;
$$;

revoke execute on function public.save_sample_pickup(jsonb, jsonb) from public, anon;
grant execute on function public.save_sample_pickup(jsonb, jsonb) to authenticated;
