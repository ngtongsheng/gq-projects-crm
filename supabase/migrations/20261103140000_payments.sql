-- Payments received against an order (loop 03 task 24). The MD, Sales Director and HR & Accounts
-- read every payment; a salesperson reads those on the MOFs they are on. Only the MD and
-- HR & Accounts record a payment, or remove one entered by mistake.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  amount numeric(14,2) not null check (amount > 0),
  received_on date not null,
  note text check (note is null or (note = btrim(note) and note <> '')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid()
);

create index payments_mof_id_idx on public.payments (mof_id);

alter table public.payments enable row level security;

-- A payment is never edited: remove it and record it again.
revoke all on table public.payments from anon, authenticated;
grant select, delete on table public.payments to authenticated;
grant insert (mof_id, amount, received_on, note) on table public.payments to authenticated;

create policy "payments: managers and the order's salespeople read"
  on public.payments for select
  to authenticated
  using (
    (select public.is_manager())
    or exists (
      select 1 from public.mofs
      where mofs.id = payments.mof_id
        and (select auth.uid()) in (mofs.salesperson_id, mofs.second_salesperson_id)
    )
  );

create policy "payments: md and accounts record"
  on public.payments for insert
  to authenticated
  with check ((select public.has_job_role('md', 'accounts')));

create policy "payments: md and accounts remove"
  on public.payments for delete
  to authenticated
  using ((select public.has_job_role('md', 'accounts')));

-- Share of the order total that must be paid before commission opens. Read by the collection
-- screen now and by the commission calculation later; the MD changes it (app_settings policies).
alter table public.app_settings
  add constraint app_settings_payment_threshold_check
  check (case
    when key <> 'payment_threshold_pct' then true
    when jsonb_typeof(value) <> 'number' then false
    else (value #>> '{}')::numeric between 1 and 100 end);

insert into public.app_settings (key, value) values ('payment_threshold_pct', '90');
