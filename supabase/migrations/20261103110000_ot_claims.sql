-- Overtime claims (loop 03 task 21). Everyone files their own; the MD, Sales Director and
-- HR & Accounts read all; only the MD or Sales Director decides, and never on their own claim.

create table public.ot_claims (
  id uuid primary key default gen_random_uuid(),
  -- Whoever files it; never part of the insert grant, so it cannot be faked.
  profile_id uuid not null default auth.uid() references public.profiles (id),
  work_date date not null,
  from_time time not null,
  to_time time not null,
  -- Worked out by the trigger below from the two times, rounded to the nearest half hour.
  hours numeric(4, 1) not null check (hours > 0),
  mof_id uuid not null references public.mofs (id),
  reason text not null check (reason = btrim(reason) and reason <> ''),
  -- What the person asked for; the approver may pick the other one.
  claim_as text not null check (claim_as in ('ot', 'replacement_leave')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_as text check (approved_as in ('ot', 'replacement_leave')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check (from_time <> to_time),
  check ((status = 'approved') = (approved_as is not null)),
  check ((status = 'pending') = (decided_by is null)),
  check ((decided_by is null) = (decided_at is null))
);

create index ot_claims_profile_id_idx on public.ot_claims (profile_id);
create index ot_claims_mof_id_idx on public.ot_claims (mof_id);
create index ot_claims_status_idx on public.ot_claims (status);

-- Minutes between the two times, wrapping past midnight, rounded to the nearest half hour.
create function public.set_ot_hours()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  minutes integer;
begin
  minutes := (extract(epoch from (new.to_time - new.from_time)) / 60)::integer;
  if minutes < 0 then
    minutes := minutes + 1440;
  end if;
  new.hours := round(minutes / 30.0) / 2;
  return new;
end;
$$;

revoke execute on function public.set_ot_hours() from public, anon, authenticated;

create trigger set_ot_hours
  before insert on public.ot_claims
  for each row execute function public.set_ot_hours();

-- A decision records who and when, from the server's clock and the signed-in user.
create function public.stamp_ot_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    new.decided_by := null;
    new.decided_at := null;
  else
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_ot_decision() from public, anon, authenticated;

create trigger stamp_ot_decision
  before update on public.ot_claims
  for each row execute function public.stamp_ot_decision();

alter table public.ot_claims enable row level security;

revoke all on table public.ot_claims from anon, authenticated;

grant select on table public.ot_claims to authenticated;
grant insert (work_date, from_time, to_time, mof_id, reason, claim_as)
  on table public.ot_claims to authenticated;
-- Deciding is the only change after a claim is filed.
grant update (status, approved_as) on table public.ot_claims to authenticated;

create policy "ot claims: read own, managers read all"
  on public.ot_claims for select
  to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_manager()));

create policy "ot claims: file your own"
  on public.ot_claims for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

-- Only a pending claim can be decided, once, and not by the person who filed it.
create policy "ot claims: MD and Sales Director decide"
  on public.ot_claims for update
  to authenticated
  using (
    status = 'pending'
    and profile_id <> (select auth.uid())
    and (select public.has_job_role('md', 'director'))
  )
  with check (
    profile_id <> (select auth.uid())
    and (select public.has_job_role('md', 'director'))
  );
