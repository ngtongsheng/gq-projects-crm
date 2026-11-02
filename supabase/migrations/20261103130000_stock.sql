-- Stock items and reservations (loop 03 task 23). Everyone signed in reads, so the same stock
-- is not promised twice. Salespeople request a hold on stock for their own project; only the
-- people who arrange stock (public.can_edit_stock()) record stock, confirm, extend or release.

-- Settings other pages share. Everyone reads; the MD and admins change them.
create table public.app_settings (
  key text primary key check (key = btrim(key) and key <> ''),
  value jsonb not null,
  -- case guarantees the cast only sees a number.
  check (case
    when key not in ('stock_hold_days', 'stock_warning_days') then true
    when jsonb_typeof(value) <> 'number' then false
    else (value #>> '{}')::numeric between 0 and 365 end)
);

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from anon, authenticated;
grant select on table public.app_settings to authenticated;
grant insert (key, value), update (value) on table public.app_settings to authenticated;

create policy "app_settings: read all"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "app_settings: admin and md add"
  on public.app_settings for insert
  to authenticated
  with check ((select public.is_admin()) or (select public.has_job_role('md')));

create policy "app_settings: admin and md change"
  on public.app_settings for update
  to authenticated
  using ((select public.is_admin()) or (select public.has_job_role('md')))
  with check ((select public.is_admin()) or (select public.has_job_role('md')));

insert into public.app_settings (key, value) values
  ('stock_hold_days', '14'),
  ('stock_warning_days', '3');

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null check (sku = btrim(sku) and sku <> ''),
  supplier text not null check (supplier = btrim(supplier) and supplier <> ''),
  collection text check (collection is null or (collection = btrim(collection) and collection <> '')),
  qty numeric(12,2) not null check (qty >= 0),
  unit text not null check (unit in ('box', 'sqft', 'm2', 'roll', 'pcs', 'slab', 'pail', 'bag')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create unique index stock_items_sku_key on public.stock_items (lower(sku));

alter table public.stock_items enable row level security;

revoke all on table public.stock_items from anon, authenticated;
grant select on table public.stock_items to authenticated;
-- The unit stays fixed once reservations count in it.
grant insert (sku, supplier, collection, qty, unit) on table public.stock_items to authenticated;
grant update (sku, supplier, collection, qty) on table public.stock_items to authenticated;

create policy "stock_items: read all"
  on public.stock_items for select
  to authenticated
  using (true);

create policy "stock_items: stock adds"
  on public.stock_items for insert
  to authenticated
  with check ((select public.can_edit_stock()));

create policy "stock_items: stock changes"
  on public.stock_items for update
  to authenticated
  using ((select public.can_edit_stock()))
  with check ((select public.can_edit_stock()));

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items (id),
  qty numeric(12,2) not null check (qty > 0),
  project_id uuid not null references public.projects (id),
  reserved_by uuid not null references public.profiles (id) default auth.uid(),
  status text not null default 'requested'
    check (status in ('requested', 'reserved', 'po_issued', 'delivered', 'released', 'cancelled')),
  -- Set when the people who arrange stock confirm; the hold runs until expires_on.
  reserved_at date,
  expires_on date,
  note text check (note is null or (note = btrim(note) and note <> '')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check (status <> 'requested' or (reserved_at is null and expires_on is null)),
  check (status not in ('reserved', 'po_issued')
    or (reserved_at is not null and expires_on is not null)),
  check (expires_on is null or expires_on >= reserved_at)
);

create index stock_reservations_item_id_idx on public.stock_reservations (item_id);
create index stock_reservations_project_id_idx on public.stock_reservations (project_id);
create index stock_reservations_status_idx on public.stock_reservations (status);

-- A hold cannot take more than what is left. Locks the item so two holds at once cannot both
-- pass. Delivered counts as sold. Security definer: locking needs update rights on the item.
create function public.guard_reservation_qty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_qty numeric;
  taken numeric;
begin
  if new.status not in ('requested', 'reserved', 'po_issued') then
    return new;
  end if;

  select qty into item_qty from public.stock_items where id = new.item_id for update;
  select coalesce(sum(qty), 0) into taken
    from public.stock_reservations
    where item_id = new.item_id
      and id is distinct from new.id
      and status in ('requested', 'reserved', 'po_issued', 'delivered');

  if new.qty > item_qty - taken then
    raise exception 'Only % left of this stock.', greatest(item_qty - taken, 0)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_reservation_qty() from public, anon, authenticated;

create trigger on_reservation_written
  before insert or update on public.stock_reservations
  for each row execute function public.guard_reservation_qty();

alter table public.stock_reservations enable row level security;

revoke all on table public.stock_reservations from anon, authenticated;
grant select on table public.stock_reservations to authenticated;
grant insert (item_id, qty, project_id, reserved_by, status, reserved_at, expires_on, note)
  on table public.stock_reservations to authenticated;
-- The item and project stay fixed; a wrong line is released and requested again.
grant update (qty, status, reserved_at, expires_on, note)
  on table public.stock_reservations to authenticated;

create policy "stock_reservations: read all"
  on public.stock_reservations for select
  to authenticated
  using (true);

-- A salesperson can only ask, for their own project and in their own name. Stock confirms.
create policy "stock_reservations: stock records, sales request"
  on public.stock_reservations for insert
  to authenticated
  with check (
    (select public.can_edit_stock())
    or (
      (select public.has_job_role('bd', 'sales'))
      and status = 'requested'
      and reserved_by = (select auth.uid())
      and exists (
        select 1 from public.projects p
        where p.id = project_id
          and (select auth.uid()) in (p.pic_id, p.support_id)
      )
    )
  );

create policy "stock_reservations: stock moves along"
  on public.stock_reservations for update
  to authenticated
  using ((select public.can_edit_stock()))
  with check ((select public.can_edit_stock()));
