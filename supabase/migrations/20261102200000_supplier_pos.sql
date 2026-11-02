-- Supplier POs (loop 03 task 15). Purchasing tracks the orders to suppliers that need
-- watching: indent, custom made or big orders. Everyone signed in reads them; the MD,
-- Purchasing and HR & Accounts keep them, like the MOF register. The full PO number is
-- the MOF number plus the 4-digit Zoho running number, worked out where it is shown.
-- The ETA is po_date + lead_time_days. A PO is never deleted: a wrong one is Cancelled.

create table public.supplier_pos (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  -- The running number from Zoho is unique across all MOFs.
  zoho_no text not null unique check (zoho_no ~ '^[0-9]{4}$'),
  supplier text not null check (supplier = btrim(supplier) and supplier <> ''),
  po_date date not null,
  lead_time_days integer not null default 0 check (lead_time_days between 0 and 3650),
  status text not null default 'ordered'
    check (status in ('pending_order', 'ordered', 'in_production', 'shipping',
      'at_kl_supplier_warehouse', 'at_best_link_warehouse', 'delivered', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create index supplier_pos_mof_id_idx on public.supplier_pos (mof_id);

alter table public.supplier_pos enable row level security;

revoke all on table public.supplier_pos from anon, authenticated;
grant select on table public.supplier_pos to authenticated;
grant insert (mof_id, zoho_no, supplier, po_date, lead_time_days, status, notes)
  on table public.supplier_pos to authenticated;
grant update (zoho_no, supplier, po_date, lead_time_days, status, notes)
  on table public.supplier_pos to authenticated;

create policy "supplier pos: read all"
  on public.supplier_pos for select
  to authenticated
  using (true);

create policy "supplier pos: register editors add"
  on public.supplier_pos for insert
  to authenticated
  with check ((select public.has_job_role('md', 'support', 'accounts')));

create policy "supplier pos: register editors edit"
  on public.supplier_pos for update
  to authenticated
  using ((select public.has_job_role('md', 'support', 'accounts')))
  with check ((select public.has_job_role('md', 'support', 'accounts')));
