-- A permanent record of every commission payout that is removed (loop 24 task 04, D8). Payouts
-- are payroll-adjacent and removing one is a hard delete, so the trigger keeps who removed it,
-- when, and the payout's full values. Nobody writes this table directly; the trigger does.

create table public.commission_payout_removals (
  id uuid primary key default gen_random_uuid(),
  -- No foreign key: the payout is gone by the time this row exists.
  payout_id uuid not null,
  payout jsonb not null,
  removed_by uuid references public.profiles (id) default auth.uid(),
  removed_at timestamptz not null default now()
);

create index commission_payout_removals_payout_id_idx
  on public.commission_payout_removals (payout_id);

alter table public.commission_payout_removals enable row level security;

revoke all on table public.commission_payout_removals from anon, authenticated;
grant select on table public.commission_payout_removals to authenticated;

-- The people who may pay out commission may read what was removed.
create policy "commission payout removals: md and accounts read"
  on public.commission_payout_removals for select
  to authenticated
  using ((select public.has_job_role('md', 'accounts')));

-- Same rule as every table (loop 11): a person who has left reads and writes nothing.
create policy "left people: no access"
  on public.commission_payout_removals as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create function public.record_commission_payout_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.commission_payout_removals (payout_id, payout)
  values (old.id, to_jsonb(old));
  return old;
end;
$$;

revoke execute on function public.record_commission_payout_removal() from public, anon, authenticated;

create trigger record_commission_payout_removal
  after delete on public.commission_payouts
  for each row execute function public.record_commission_payout_removal();
