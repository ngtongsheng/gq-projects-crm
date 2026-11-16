-- Loop 18 task 09 (D5): leftover stock follows the demo's returns. A Site Supervisor can mark
-- an item collected and say how it goes back; purchasing arranges transport (Lalamove / lorry),
-- names the supplier or why GQ keeps it, and keys in the credit note. Items GQ keeps at Best
-- Link can be used for another project; the uses never exceed what is there. Additive: every
-- existing row keeps its values and every new column starts empty.

-- The new status sits between waiting for pickup and arriving at the supplier or Best Link.
alter table public.leftovers
  drop constraint leftovers_status_check,
  add constraint leftovers_status_check check (status in ('pending_pickup',
    'collected_by_supervisor', 'returned_to_supplier', 'at_best_link', 'left_with_client',
    'disposed'));

alter table public.leftovers
  -- How it goes back from site: the installer brings it, the office arranges transport, or
  -- the supervisor brings it.
  add column return_method text check (return_method in ('installer', 'transport', 'supervisor')),
  -- Purchasing arranges the transport; empty while it is still to arrange.
  add column transport_by text check (transport_by is null
    or (transport_by = btrim(transport_by) and transport_by <> '')),
  add column transport_on date,
  add column transport_to text check (transport_to is null
    or (transport_to = btrim(transport_to) and transport_to <> '')),
  add column transport_cost numeric(14,2) check (transport_cost >= 0),
  add column transport_arranged_at timestamptz,
  add column transport_arranged_by uuid references public.profiles (id),
  add column supplier text check (supplier is null or (supplier = btrim(supplier) and supplier <> '')),
  add column keep_reason text check (keep_reason in ('custom_made', 'indent_from_china',
    'gq_own_stock', 'ordered_wrong', 'others')),
  -- The salesperson who ordered the wrong stock.
  add column ordered_wrong_by uuid references public.profiles (id),
  -- The supervisor sent the office the WhatsApp (photo and message) about it.
  add column whatsapp_sent_at timestamptz,
  add column collected_at timestamptz,
  add column collected_by uuid references public.profiles (id),
  -- Where the supervisor took it, recorded by purchasing afterwards.
  add column collected_to text check (collected_to is null
    or (collected_to = btrim(collected_to) and collected_to <> '')),
  -- When it reached the supplier or Best Link ("At Best Link since").
  add column received_at timestamptz,
  add column received_by uuid references public.profiles (id),
  add column credit_note_at timestamptz,
  add column credit_note_by uuid references public.profiles (id),
  add constraint leftovers_transport_check check (return_method = 'transport'
    or (transport_by is null and transport_on is null and transport_to is null
      and transport_cost is null)),
  add constraint leftovers_transport_arranged_check check ((transport_by is null) = (transport_on is null)
    and (transport_by is not null or (transport_to is null and transport_cost is null))),
  add constraint leftovers_supplier_destination_check check (supplier is null or destination = 'supplier'),
  add constraint leftovers_keep_reason_destination_check check (keep_reason is null or destination = 'gq'),
  add constraint leftovers_ordered_wrong_check check (ordered_wrong_by is null
    or keep_reason = 'ordered_wrong');

grant insert (return_method, supplier, keep_reason, ordered_wrong_by, whatsapp_sent_at)
  on table public.leftovers to authenticated;
grant update (return_method, transport_by, transport_on, transport_to, transport_cost, supplier,
  keep_reason, ordered_wrong_by, whatsapp_sent_at, collected_to)
  on table public.leftovers to authenticated;

-- A Site Supervisor marks an item collected and sends the WhatsApp; the guard below keeps them
-- to those fields. Moving it along further stays with the people who arrange stock.
create policy "leftovers: site supervisor collects"
  on public.leftovers for update
  to authenticated
  using ((select public.has_job_role('site'))
    and status in ('pending_pickup', 'collected_by_supervisor'))
  with check ((select public.has_job_role('site'))
    and status in ('pending_pickup', 'collected_by_supervisor'));

-- Stamps who did what and when, so the audit cannot be keyed in by hand, and keeps a Site
-- Supervisor to collecting.
create function public.guard_leftover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The service role (no signed-in user) is the example data and imports, not a supervisor.
  if tg_op = 'UPDATE' and (select auth.uid()) is not null
    and not (select public.can_edit_stock()) and (
    (new.status is distinct from old.status and new.status <> 'collected_by_supervisor')
    or (to_jsonb(new) - array['status', 'return_method', 'whatsapp_sent_at', 'collected_at',
        'collected_by'])
      is distinct from (to_jsonb(old) - array['status', 'return_method', 'whatsapp_sent_at',
        'collected_at', 'collected_by'])
  ) then
    raise exception 'A Site Supervisor can only mark leftover stock collected.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'collected_by_supervisor' then
      new.collected_at := now();
      new.collected_by := auth.uid();
    elsif new.status in ('returned_to_supplier', 'at_best_link') then
      new.received_at := now();
      new.received_by := auth.uid();
    end if;
  end if;

  if new.transport_by is not null
    and (tg_op = 'INSERT' or old.transport_by is null) then
    new.transport_arranged_at := now();
    new.transport_arranged_by := auth.uid();
  elsif new.transport_by is null then
    new.transport_arranged_at := null;
    new.transport_arranged_by := null;
  end if;

  if new.credit_note_no is not null
    and (tg_op = 'INSERT' or old.credit_note_no is null) then
    new.credit_note_at := now();
    new.credit_note_by := auth.uid();
  elsif new.credit_note_no is null then
    new.credit_note_at := null;
    new.credit_note_by := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_leftover() from public, anon, authenticated;

create trigger guard_leftover
  before insert or update on public.leftovers
  for each row execute function public.guard_leftover();

-- Stock GQ keeps at Best Link used for another project (the demo's "Use for project").
create table public.leftover_allocations (
  id uuid primary key default gen_random_uuid(),
  leftover_id uuid not null references public.leftovers (id),
  project_id uuid not null references public.projects (id),
  qty numeric(12,2) not null check (qty > 0),
  allocated_on date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  note text check (note is null or (note = btrim(note) and note <> '')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create index leftover_allocations_leftover_id_idx on public.leftover_allocations (leftover_id);
create index leftover_allocations_project_id_idx on public.leftover_allocations (project_id);

alter table public.leftover_allocations enable row level security;

revoke all on table public.leftover_allocations from anon, authenticated;

grant select on table public.leftover_allocations to authenticated;
grant insert (leftover_id, project_id, qty, allocated_on, note)
  on table public.leftover_allocations to authenticated;

create policy "leftover allocations: read all"
  on public.leftover_allocations for select
  to authenticated
  using (true);

create policy "leftover allocations: stock records"
  on public.leftover_allocations for insert
  to authenticated
  with check ((select public.can_edit_stock()));

create policy "left people: no access"
  on public.leftover_allocations as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- Locking the leftover row first serialises everyone using the same item, so two uses at once
-- can never take more than is at Best Link.
create function public.guard_leftover_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  leftover record;
  used numeric;
begin
  select qty, status into leftover from public.leftovers where id = new.leftover_id for update;
  if not found then
    raise exception 'This leftover item is no longer in the list.' using errcode = '23503';
  end if;
  if leftover.status <> 'at_best_link' then
    raise exception 'Only leftover stock at Best Link can be used for a project.'
      using errcode = '23514';
  end if;

  select coalesce(sum(qty), 0) into used
  from public.leftover_allocations where leftover_id = new.leftover_id;
  if used + new.qty > leftover.qty then
    raise exception 'Only % left at Best Link.', leftover.qty - used using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_leftover_allocation() from public, anon, authenticated;

create trigger guard_leftover_allocation
  before insert on public.leftover_allocations
  for each row execute function public.guard_leftover_allocation();
