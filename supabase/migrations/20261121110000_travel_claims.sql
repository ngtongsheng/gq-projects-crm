-- Loop 25 task 02: travel claims (demo vTClaims, D1). One claim per person per claim month holds
-- five keyed totals and a remark; receipts stay on paper. Flow (demo 1.7):
--   draft --the person submits--> submitted --md/accounts Release--> released (final)
--   submitted --md/accounts Return--> draft
-- Release needs the person's monthly report for the SAME month submitted or later (D3), unless
-- their role files none (the Sales Director). The person edits their claim until it is released;
-- md and accounts set only the final amount, their note, the "verified with Vicky" date and the
-- status.

-- D7: only the cut-off day is still used; the other stored claim settings stay, unchecked.
alter table public.app_settings
  drop constraint app_settings_claims_check,
  add constraint app_settings_claims_check
  check (case
    when key <> 'claims' then true
    when jsonb_typeof(value) is distinct from 'object'
      or jsonb_typeof(value -> 'cutOffDay') is distinct from 'number' then false
    else (value ->> 'cutOffDay')::numeric between 1 and 28
      and mod((value ->> 'cutOffDay')::numeric, 1) = 0 end);

create table public.travel_claims (
  id uuid primary key default gen_random_uuid(),
  -- Whoever starts it; never part of the insert grant, so it cannot be faked.
  profile_id uuid not null default auth.uid() references public.profiles (id),
  -- The first day of the claim month; days after the cut-off day belong to the next month.
  month date not null check (month = date_trunc('month', month)::date),
  -- Empty means not keyed in (demo stores "").
  petrol_parking_toll numeric(12, 2) check (petrol_parking_toll >= 0),
  outstation numeric(12, 2) check (outstation >= 0),
  hotel numeric(12, 2) check (hotel >= 0),
  others numeric(12, 2) check (others >= 0),
  others_description text check (others_description = btrim(others_description)
    and others_description <> '' and char_length(others_description) <= 300),
  -- Approved OT, Site Supervisors only (guard_travel_claim_write).
  overtime numeric(12, 2) check (overtime >= 0),
  remark text check (remark = btrim(remark) and remark <> '' and char_length(remark) <= 1000),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'released')),
  -- Malaysia dates, stamped by guard_travel_claim_write; not in any grant.
  submitted_on date,
  updated_on date,
  -- What is paid when it differs from the total, and Jany's note shown to the person.
  final_amount numeric(12, 2) check (final_amount >= 0),
  final_note text check (final_note = btrim(final_note) and final_note <> ''
    and char_length(final_note) <= 500),
  verified_with_vicky_on date,
  released_on date,
  released_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (profile_id, month),
  check (coalesce(others, 0) = 0 or others_description is not null),
  -- Demo "Key in at least one amount" before it goes to Jany.
  check (status = 'draft' or coalesce(petrol_parking_toll, 0) + coalesce(outstation, 0)
    + coalesce(hotel, 0) + coalesce(others, 0) + coalesce(overtime, 0) > 0),
  check ((status = 'draft') or submitted_on is not null),
  check ((status = 'released') = (released_on is not null)),
  check ((released_on is null) = (released_by is null))
);

create index travel_claims_month_idx on public.travel_claims (month);

-- Files a travel claim at all (demo clCanClaimExp; mirrors canFileClaim in claim-eligibility.ts).
create function public.files_travel_claim()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active
      and (job_role in ('sales', 'bd', 'director', 'site') or sells)
  );
$$;

revoke execute on function public.files_travel_claim() from public, anon;
grant execute on function public.files_travel_claim() to authenticated;

-- The flow and who may change which column, which RLS cannot express per column. Security
-- definer: md and accounts cannot read the person's profile or monthly report themselves.
-- Skipped when there is no signed-in user (the service role, e.g. example data scripts).
create function public.guard_travel_claim_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  today constant date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  mine boolean;
  manager boolean;
begin
  if me is null then
    return new;
  end if;

  if new.overtime is not null
    and (tg_op = 'INSERT' or new.overtime is distinct from old.overtime)
    and not exists (
      select 1 from public.profiles where id = new.profile_id and job_role = 'site'
    ) then
    raise exception 'Only Site Supervisors claim overtime.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'A new claim is a draft or submitted.' using errcode = '42501';
    end if;
    new.submitted_on := case when new.status = 'submitted' then today end;
    return new;
  end if;

  if old.status = 'released' then
    raise exception 'A released claim cannot be changed.' using errcode = '42501';
  end if;

  mine := old.profile_id = me;
  -- Nobody checks or releases their own claim.
  manager := not mine and public.has_job_role('md', 'accounts');

  if (new.month, new.petrol_parking_toll, new.outstation, new.hotel, new.others,
      new.others_description, new.overtime, new.remark)
    is distinct from (old.month, old.petrol_parking_toll, old.outstation, old.hotel, old.others,
      old.others_description, old.overtime, old.remark) then
    if not mine then
      raise exception 'Only the person changes their claim.' using errcode = '42501';
    end if;
    if old.status = 'submitted' and new.status = 'submitted' then
      new.updated_on := today;
    end if;
  end if;

  if (new.final_amount, new.final_note, new.verified_with_vicky_on)
    is distinct from (old.final_amount, old.final_note, old.verified_with_vicky_on)
    and not (manager and old.status = 'submitted') then
    raise exception 'Only HR & Accounts or the MD checks a submitted claim.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if mine and old.status = 'draft' and new.status = 'submitted' then
      -- A returned claim keeps the date it was first submitted (demo subAt).
      new.submitted_on := coalesce(old.submitted_on, today);
    elsif manager and old.status = 'submitted' and new.status = 'draft' then
      null;
    elsif manager and old.status = 'submitted' and new.status = 'released' then
      -- Roles that file no monthly report (the Sales Director) have nothing to wait for;
      -- the roles here mirror reportKindFor in report-stats.ts.
      if exists (
        select 1 from public.profiles p
        where p.id = old.profile_id and p.job_role in ('sales', 'bd', 'site')
      ) and not exists (
        select 1 from public.monthly_reports r
        where r.profile_id = old.profile_id
          and r.month = old.month
          and r.status in ('submitted', 'reviewed', 'approved')
      ) then
        raise exception 'Monthly report not submitted yet.' using errcode = '42501';
      end if;
      new.released_on := today;
      new.released_by := me;
    else
      raise exception 'A claim cannot go from % to % here.', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_travel_claim_write() from public, anon, authenticated;

create trigger guard_travel_claim_write
  before insert or update on public.travel_claims
  for each row execute function public.guard_travel_claim_write();

alter table public.travel_claims enable row level security;

revoke all on table public.travel_claims from anon, authenticated;
grant select on table public.travel_claims to authenticated;
grant insert (month, petrol_parking_toll, outstation, hotel, others, others_description,
  overtime, remark, status)
  on table public.travel_claims to authenticated;
grant update (month, petrol_parking_toll, outstation, hotel, others, others_description,
  overtime, remark, status, final_amount, final_note, verified_with_vicky_on)
  on table public.travel_claims to authenticated;

create policy "travel claims: own, md and accounts read"
  on public.travel_claims for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select public.has_job_role('md', 'accounts'))
  );

create policy "travel claims: claimants start their own"
  on public.travel_claims for insert
  to authenticated
  with check (profile_id = (select auth.uid()) and (select public.files_travel_claim()));

-- Which columns and steps is checked by guard_travel_claim_write().
create policy "travel claims: the person or md and accounts change"
  on public.travel_claims for update
  to authenticated
  using (
    (profile_id = (select auth.uid()) and status <> 'released')
    or (status = 'submitted' and (select public.has_job_role('md', 'accounts')))
  )
  with check (
    profile_id = (select auth.uid()) or (select public.has_job_role('md', 'accounts'))
  );

create policy "left people: no access"
  on public.travel_claims as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
