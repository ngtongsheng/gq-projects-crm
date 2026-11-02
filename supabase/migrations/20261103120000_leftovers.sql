-- Leftover stock from a site (loop 03 task 22). Everyone signed in reads it; Site Supervisors
-- and the people who arrange stock record it; only the people who arrange stock move it along
-- (pickup, return, credit note).

-- Who arranges stock: the MD, Sales Director, Purchasing, or anyone ticked "arranges stock" on
-- their profile. Mirrors canEditStock in src/lib/auth/job-role.ts.
create function public.can_edit_stock()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and (job_role in ('md', 'director', 'support') or arranges_stock)
  );
$$;

revoke execute on function public.can_edit_stock() from public, anon;
grant execute on function public.can_edit_stock() to authenticated;

create table public.leftovers (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  item text not null check (item = btrim(item) and item <> ''),
  qty numeric(12,2) not null check (qty > 0),
  unit text not null check (unit in ('box', 'm2', 'roll', 'pcs', 'pail', 'bag')),
  condition text not null check (condition in ('good', 'offcut', 'damaged')),
  -- supplier: goes back for a credit note; gq: GQ keeps it at Best Link.
  destination text not null check (destination in ('supplier', 'gq')),
  status text not null default 'pending_pickup' check (status in ('pending_pickup',
    'returned_to_supplier', 'at_best_link', 'left_with_client', 'disposed')),
  note text check (note is null or (note = btrim(note) and note <> '')),
  credit_note_no text check (credit_note_no is null or (credit_note_no = btrim(credit_note_no)
    and credit_note_no <> '')),
  credit_note_amount numeric(14,2) check (credit_note_amount >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check (status <> 'returned_to_supplier' or destination = 'supplier'),
  check (status <> 'at_best_link' or destination = 'gq'),
  check (destination = 'supplier'
    or (credit_note_no is null and credit_note_amount is null)),
  check (credit_note_amount is null or credit_note_no is not null)
);

create index leftovers_mof_id_idx on public.leftovers (mof_id);
create index leftovers_status_idx on public.leftovers (status);

alter table public.leftovers enable row level security;

revoke all on table public.leftovers from anon, authenticated;

grant select on table public.leftovers to authenticated;
-- The credit note comes later from the supplier, so it is not part of recording.
grant insert (mof_id, item, qty, unit, condition, destination, status, note)
  on table public.leftovers to authenticated;
grant update (condition, destination, status, note, credit_note_no, credit_note_amount)
  on table public.leftovers to authenticated;

create policy "leftovers: read all"
  on public.leftovers for select
  to authenticated
  using (true);

-- A Site Supervisor can only record an item waiting for pickup; moving it along is for stock.
create policy "leftovers: site and stock record"
  on public.leftovers for insert
  to authenticated
  with check (
    (select public.can_edit_stock())
    or (
      (select public.has_job_role('site'))
      and status = 'pending_pickup'
    )
  );

create policy "leftovers: stock moves along"
  on public.leftovers for update
  to authenticated
  using ((select public.can_edit_stock()))
  with check ((select public.can_edit_stock()));
