-- Installer POs and claims (loop 03 task 16). An MOF can have a PO to each installer
-- appointed for it. The installer then claims progress, final and deduction (back-charge)
-- amounts against that PO. Only the MD, Directors, HR & Accounts, Purchasing and Site
-- Supervisors see them. The MD, Purchasing and HR & Accounts keep POs and claim details;
-- Site Supervisors verify the work; the MD and HR & Accounts record payment. A claim is
-- never deleted: a wrong one is corrected, which clears its verification.

create table public.installer_pos (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  po_no text not null check (po_no = btrim(po_no) and po_no <> ''),
  po_date date not null,
  installer text not null check (installer = btrim(installer) and installer <> ''),
  amount numeric(14,2) not null check (amount > 0),
  scope text,
  retention_pct numeric(5,2) not null default 0 check (retention_pct between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  unique (mof_id, installer)
);

create index installer_pos_mof_id_idx on public.installer_pos (mof_id);

create table public.installer_claims (
  id uuid primary key default gen_random_uuid(),
  installer_po_id uuid not null references public.installer_pos (id),
  claim_type text not null check (claim_type in ('progress', 'final', 'deduction')),
  claim_no text check (claim_no is null or (claim_no = btrim(claim_no) and claim_no <> '')),
  amount numeric(14,2) not null check (amount > 0),
  claimed_on date not null,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  paid_on date,
  paid_amount numeric(14,2) check (paid_amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check ((verified_by is null) = (verified_at is null)),
  check ((paid_on is null) = (paid_amount is null)),
  -- A deduction is taken off what is owed; it is neither verified nor paid.
  check (claim_type <> 'deduction' or (verified_by is null and paid_on is null)),
  check (paid_on is null or verified_by is not null),
  check (paid_amount is null or paid_amount <= amount)
);

create index installer_claims_po_idx on public.installer_claims (installer_po_id);

alter table public.installer_pos enable row level security;
alter table public.installer_claims enable row level security;

revoke all on table public.installer_pos from anon, authenticated;
revoke all on table public.installer_claims from anon, authenticated;

grant select on table public.installer_pos to authenticated;
grant insert (mof_id, po_no, po_date, installer, amount, scope, retention_pct)
  on table public.installer_pos to authenticated;
grant update (po_no, po_date, installer, amount, scope, retention_pct)
  on table public.installer_pos to authenticated;

grant select on table public.installer_claims to authenticated;
grant insert (installer_po_id, claim_type, claim_no, amount, claimed_on)
  on table public.installer_claims to authenticated;
-- Who may change which column is decided by the trigger below.
grant update (claim_type, claim_no, amount, claimed_on,
  verified_by, verified_at, paid_on, paid_amount)
  on table public.installer_claims to authenticated;

create policy "installer pos: read"
  on public.installer_pos for select
  to authenticated
  using ((select public.has_job_role('md', 'director', 'accounts', 'support', 'site')));

create policy "installer pos: register editors add"
  on public.installer_pos for insert
  to authenticated
  with check ((select public.has_job_role('md', 'support', 'accounts')));

create policy "installer pos: register editors edit"
  on public.installer_pos for update
  to authenticated
  using ((select public.has_job_role('md', 'support', 'accounts')))
  with check ((select public.has_job_role('md', 'support', 'accounts')));

create policy "installer claims: read"
  on public.installer_claims for select
  to authenticated
  using ((select public.has_job_role('md', 'director', 'accounts', 'support', 'site')));

create policy "installer claims: register editors add"
  on public.installer_claims for insert
  to authenticated
  with check ((select public.has_job_role('md', 'support', 'accounts')));

-- Verifiers and payers update the same row as the editors, so the row policy lets all
-- of them in and the trigger below checks the column each one changes.
create policy "installer claims: update"
  on public.installer_claims for update
  to authenticated
  using ((select public.has_job_role('md', 'director', 'accounts', 'support', 'site')))
  with check ((select public.has_job_role('md', 'director', 'accounts', 'support', 'site')));

create function public.guard_installer_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  details_changed boolean;
  work_changed boolean;
  verify_changed boolean;
  pay_changed boolean;
begin
  if tg_op = 'INSERT' then
    -- A new claim always starts unverified and unpaid.
    if new.verified_by is not null or new.verified_at is not null
      or new.paid_on is not null or new.paid_amount is not null then
      raise exception 'A new claim cannot be verified or paid.' using errcode = '42501';
    end if;
    return new;
  end if;

  work_changed := new.claim_type is distinct from old.claim_type
    or new.amount is distinct from old.amount
    or new.claimed_on is distinct from old.claimed_on;
  details_changed := work_changed or new.claim_no is distinct from old.claim_no;
  verify_changed := new.verified_by is distinct from old.verified_by
    or new.verified_at is distinct from old.verified_at;
  pay_changed := new.paid_on is distinct from old.paid_on
    or new.paid_amount is distinct from old.paid_amount;

  if (details_changed and verify_changed) or (details_changed and pay_changed)
    or (verify_changed and pay_changed) then
    raise exception 'Change the claim, its verification or its payment one at a time.'
      using errcode = '42501';
  end if;

  if details_changed then
    if not (select public.has_job_role('md', 'support', 'accounts')) then
      raise exception 'Only the MD, Purchasing or HR & Accounts can change a claim.'
        using errcode = '42501';
    end if;
    if old.paid_on is not null then
      raise exception 'A paid claim cannot be changed.' using errcode = '42501';
    end if;
    -- The supervisor checked the old figures, so a changed claim is checked again.
    if work_changed then
      new.verified_by := null;
      new.verified_at := null;
    end if;
  end if;

  if verify_changed then
    if not (select public.has_job_role('md', 'director', 'site')) then
      raise exception 'Only a Site Supervisor can verify installer work.'
        using errcode = '42501';
    end if;
    if old.paid_on is not null then
      raise exception 'A paid claim cannot be verified again.' using errcode = '42501';
    end if;
    if new.verified_by is not null then
      if new.verified_by is distinct from (select auth.uid()) then
        raise exception 'You can only verify a claim as yourself.' using errcode = '42501';
      end if;
      new.verified_at := now();
    else
      new.verified_at := null;
    end if;
  end if;

  if pay_changed then
    if not (select public.has_job_role('md', 'accounts')) then
      raise exception 'Only the MD or HR & Accounts can record a payment.'
        using errcode = '42501';
    end if;
    if new.paid_on is not null and new.verified_by is null then
      raise exception 'The site supervisor must verify the work before payment.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_installer_claim
  before insert or update on public.installer_claims
  for each row execute function public.guard_installer_claim();
