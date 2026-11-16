-- Loop 18 task 04 (D2): the app issues DO running numbers instead of Zoho. The next number is
-- max(used, cancelled) + 1, starting at 5541, and never below the number the MD, Purchasing or
-- HR & Accounts set once to continue from their last manual DO. A number that is taken off a DO
-- goes to the cancelled list and is never used again. DOs get their lines (what was delivered),
-- a DO date and "passed to supplier". Additive: existing DOs keep every value.

alter table public.delivery_orders
  -- The date printed on the DO; the app shows the job's start date when it is empty.
  add column do_date date,
  -- The supplier delivers straight to site with our DO.
  add column passed_to_supplier boolean not null default false,
  -- Set when the app issued the number; empty for numbers keyed in from Zoho.
  add column issued_at timestamptz,
  add column issued_by uuid references public.profiles (id);

grant insert (do_date, passed_to_supplier) on table public.delivery_orders to authenticated;
grant update (do_date, passed_to_supplier) on table public.delivery_orders to authenticated;

-- One row: the lowest number the next DO may take. Locking it serialises everyone issuing a
-- number, so two people can never get the same one. Written only by the functions below.
create table public.delivery_order_numbering (
  id boolean primary key default true check (id),
  next_no integer not null check (next_no > 0)
);

insert into public.delivery_order_numbering (next_no) values (5541);

-- Running numbers taken off a DO (the DO was cancelled or renumbered). Never reused.
-- The app never deletes jobs or MOFs; the cascade only lets the example-data reset clear them.
create table public.cancelled_delivery_order_numbers (
  running_no text primary key check (running_no ~ '^[0-9]{4}$'),
  mof_id uuid not null references public.mofs (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  cancelled_at timestamptz not null default now(),
  cancelled_by uuid references public.profiles (id) default auth.uid()
);

create index cancelled_delivery_order_numbers_mof_id_idx
  on public.cancelled_delivery_order_numbers (mof_id);

create table public.delivery_order_lines (
  id uuid primary key default gen_random_uuid(),
  delivery_order_id uuid not null references public.delivery_orders (id) on delete cascade,
  -- Row order on the printed DO.
  position integer not null check (position > 0),
  product text not null check (product = btrim(product) and product <> ''),
  code text check (code is null or (code = btrim(code) and code <> '')),
  description text check (description is null or (description = btrim(description) and description <> '')),
  batch text check (batch is null or (batch = btrim(batch) and batch <> '')),
  unit text not null check (unit in ('Box', 'Pc', 'Roll', 'm²', 'sqft', 'm', 'Pail', 'Set', 'Lot')),
  qty numeric(12,2) not null check (qty >= 0),
  -- Free text, e.g. "1550 sqft".
  covers text check (covers is null or (covers = btrim(covers) and covers <> '')),
  unique (delivery_order_id, position)
);

alter table public.delivery_order_numbering enable row level security;
alter table public.cancelled_delivery_order_numbers enable row level security;
alter table public.delivery_order_lines enable row level security;

revoke all on table public.delivery_order_numbering from anon, authenticated;
revoke all on table public.cancelled_delivery_order_numbers from anon, authenticated;
revoke all on table public.delivery_order_lines from anon, authenticated;

grant select on table public.delivery_order_numbering to authenticated;
grant select on table public.cancelled_delivery_order_numbers to authenticated;
grant select, delete on table public.delivery_order_lines to authenticated;
grant insert (delivery_order_id, position, product, code, description, batch, unit, qty, covers)
  on table public.delivery_order_lines to authenticated;
grant update (position, product, code, description, batch, unit, qty, covers)
  on table public.delivery_order_lines to authenticated;

create policy "delivery order numbering: read all"
  on public.delivery_order_numbering for select
  to authenticated
  using (true);

create policy "cancelled delivery order numbers: read all"
  on public.cancelled_delivery_order_numbers for select
  to authenticated
  using (true);

-- Lines follow their DO: everyone reads, the schedulers who edit DOs write.
create policy "delivery order lines: read all"
  on public.delivery_order_lines for select
  to authenticated
  using (true);

create policy "delivery order lines: schedulers add"
  on public.delivery_order_lines for insert
  to authenticated
  with check ((select public.has_job_role('md', 'director', 'support')));

create policy "delivery order lines: schedulers edit"
  on public.delivery_order_lines for update
  to authenticated
  using ((select public.has_job_role('md', 'director', 'support')))
  with check ((select public.has_job_role('md', 'director', 'support')));

create policy "delivery order lines: schedulers remove"
  on public.delivery_order_lines for delete
  to authenticated
  using ((select public.has_job_role('md', 'director', 'support')));

create policy "left people: no access"
  on public.delivery_order_numbering as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.cancelled_delivery_order_numbers as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.delivery_order_lines as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- The highest running number used on a DO or cancelled, or 0 when there is none.
create function public.last_delivery_order_number()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(running_no::integer), 0) from (
    select running_no from public.delivery_orders where running_no is not null
    union all
    select running_no from public.cancelled_delivery_order_numbers
  ) numbers;
$$;

-- Unchanged from the jobs migration, except a cancelled number cannot be keyed in again.
create or replace function public.guard_delivery_order()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  job record;
begin
  select mof_id, job_type, status into job from public.jobs where id = new.job_id;
  if job.job_type is distinct from 'delivery' or job.mof_id is distinct from new.mof_id then
    raise exception 'A DO belongs to a delivery job of the same MOF.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and (new.job_id is distinct from old.job_id
    or new.mof_id is distinct from old.mof_id) then
    raise exception 'A DO cannot move to another job.' using errcode = '23514';
  end if;

  if job.status = 'done' and new.running_no is null then
    raise exception 'Key in the Zoho DO no. before marking the delivery Done.'
      using errcode = '23514';
  end if;

  if new.running_no is not null
    and (tg_op = 'INSERT' or new.running_no is distinct from old.running_no)
    and exists (
      select 1 from public.cancelled_delivery_order_numbers where running_no = new.running_no
    ) then
    raise exception 'Running no. % belongs to a cancelled DO and is never reused.', new.running_no
      using errcode = '23505';
  end if;

  return new;
end;
$$;

-- A running number taken off a DO, by changing it, clearing it or removing the DO, is cancelled.
-- Security definer: nobody writes the cancelled list directly.
create function public.cancel_delivery_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.running_no is not null
    and (tg_op = 'DELETE' or new.running_no is distinct from old.running_no) then
    insert into public.cancelled_delivery_order_numbers (running_no, mof_id, job_id)
    values (old.running_no, old.mof_id, old.job_id);
  end if;
  return null;
end;
$$;

create trigger cancel_delivery_order_number
  after update of running_no or delete on public.delivery_orders
  for each row execute function public.cancel_delivery_order_number();

revoke execute on function public.cancel_delivery_order_number() from public, anon, authenticated;

-- "Issue DO no. now": gives the delivery job's DO the next running number, adding the DO when
-- the job has none yet, and returns the 4-digit number. A DO that already has a number keeps it.
create function public.issue_do_number(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  job record;
  current_no text;
  floor_no integer;
  issued integer;
begin
  if not (select public.has_job_role('md', 'director', 'support')) then
    raise exception 'Only the MD, Sales Director or Purchasing can issue a DO no.'
      using errcode = '42501';
  end if;

  -- Held until the transaction ends: a second caller waits here and then sees this number used.
  select next_no into floor_no from public.delivery_order_numbering for update;

  select id, mof_id, job_type into job from public.jobs where id = p_job_id;
  if job.id is null or job.job_type <> 'delivery' then
    raise exception 'A DO no. is issued for a delivery job.' using errcode = '23514';
  end if;

  select running_no into current_no from public.delivery_orders where job_id = p_job_id;
  if current_no is not null then
    return current_no;
  end if;

  issued := greatest(floor_no, public.last_delivery_order_number() + 1);

  insert into public.delivery_orders (mof_id, job_id, running_no, issued_at, issued_by)
  values (job.mof_id, p_job_id, lpad(issued::text, 4, '0'), now(), auth.uid())
  on conflict (job_id) do update
    set running_no = excluded.running_no,
      issued_at = excluded.issued_at,
      issued_by = excluded.issued_by;

  update public.delivery_order_numbering set next_no = issued + 1;

  return lpad(issued::text, 4, '0');
end;
$$;

revoke execute on function public.issue_do_number(uuid) from public, anon;
grant execute on function public.issue_do_number(uuid) to authenticated;

-- "Next DO running number": set once to continue from the last manual DO. It must be higher
-- than every number used or cancelled.
create function public.set_next_do_number(p_next_no integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_no integer;
begin
  if not (select public.has_job_role('md', 'support', 'accounts')) then
    raise exception 'Only the MD, Purchasing or HR & Accounts can set the next DO no.'
      using errcode = '42501';
  end if;

  perform 1 from public.delivery_order_numbering for update;

  last_no := public.last_delivery_order_number();
  if p_next_no is null or p_next_no <= last_no then
    raise exception 'The next DO no. must be higher than the last number used (%).', last_no
      using errcode = '23514';
  end if;
  if p_next_no > 9999 then
    raise exception 'The next DO no. has 4 digits.' using errcode = '23514';
  end if;

  update public.delivery_order_numbering set next_no = p_next_no;
end;
$$;

revoke execute on function public.set_next_do_number(integer) from public, anon;
grant execute on function public.set_next_do_number(integer) to authenticated;

-- The number "Issue DO no. now" would give, for the form and the delivery log.
create function public.next_do_number()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lpad(greatest(next_no, public.last_delivery_order_number() + 1)::text, 4, '0')
  from public.delivery_order_numbering;
$$;

revoke execute on function public.last_delivery_order_number() from public, anon;
grant execute on function public.last_delivery_order_number() to authenticated;
revoke execute on function public.next_do_number() from public, anon;
grant execute on function public.next_do_number() to authenticated;

-- What the MOF's other DOs already delivered, per item and unit, for "Delivered on earlier DOs".
-- An item is its code, else its description, else its product. Postponed jobs did not deliver.
create function public.delivered_to_date(p_mof_id uuid, p_except_job_id uuid default null)
returns table (item text, unit text, qty numeric)
language sql
stable
set search_path = ''
as $$
  select coalesce(l.code, l.description, l.product) as item, l.unit, sum(l.qty) as qty
  from public.delivery_order_lines l
  join public.delivery_orders d on d.id = l.delivery_order_id
  join public.jobs j on j.id = d.job_id
  where d.mof_id = p_mof_id
    and j.status <> 'postponed'
    and (p_except_job_id is null or d.job_id <> p_except_job_id)
  group by 1, 2
  order by 1, 2;
$$;

revoke execute on function public.delivered_to_date(uuid, uuid) from public, anon;
grant execute on function public.delivered_to_date(uuid, uuid) to authenticated;
