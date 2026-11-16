-- Loop 19 task 01: monthly claims (demo vClaims). One claim per person per month (D1) holds
-- (A) commission lines, (B) travelling expenses with numbered receipts and (C) the month's OT
-- total, frozen at submit. Each line keeps what the person claimed (original_amount) next to
-- what was approved (amount), with the checker's reason when they differ.
--
-- Flow (D1): draft -> submitted -> checked (HR & Accounts) -> approved (HR & Accounts or MD)
-- -> paid; returned from submitted or checked, then submitted again. Nobody moves their own
-- claim past submitted. Every status change is written to monthly_claim_log.
--
-- Who reads: the person, the MD and HR & Accounts; the Sales Director reads their team's.
-- Who writes: the person while the claim is a draft or returned; the MD or HR & Accounts
-- adjust amounts while it is submitted, checked or approved.
--
-- D2: a commission line (order, person) sits in at most one submitted, checked or approved
-- claim, by a unique index. Payable-now is the most a line may claim.

-- Claim settings (demo clCfg). The late-collection cuts stay in the 'commission' rules.
alter table public.app_settings
  add constraint app_settings_claims_check
  check (case
    when key <> 'claims' then true
    when jsonb_typeof(value) is distinct from 'object'
      or jsonb_typeof(value -> 'cutOffDay') is distinct from 'number'
      or jsonb_typeof(value -> 'mileageRatePerKm') is distinct from 'number'
      or jsonb_typeof(value -> 'kmPerDay') is distinct from 'number'
      or jsonb_typeof(value -> 'monthlyTravelLimit') is distinct from 'number'
      or jsonb_typeof(value -> 'needReport') is distinct from 'boolean' then false
    else (value ->> 'cutOffDay')::numeric between 1 and 28
      and mod((value ->> 'cutOffDay')::numeric, 1) = 0
      and (value ->> 'mileageRatePerKm')::numeric between 0 and 10
      and (value ->> 'kmPerDay')::numeric > 0
      -- 0 means no monthly travel limit.
      and (value ->> 'monthlyTravelLimit')::numeric >= 0 end);

insert into public.app_settings (key, value) values (
  'claims',
  '{"cutOffDay": 25, "mileageRatePerKm": 0.6, "kmPerDay": 150, "monthlyTravelLimit": 0, "needReport": true}'
)
on conflict (key) do nothing;

-- The claim settings page is for the MD and HR & Accounts (demo clCanManage); the existing
-- policies already let the MD and admins write any setting.
create policy "app_settings: accounts add claim settings"
  on public.app_settings for insert
  to authenticated
  with check (key = 'claims' and (select public.has_job_role('accounts')));

create policy "app_settings: accounts change claim settings"
  on public.app_settings for update
  to authenticated
  using (key = 'claims' and (select public.has_job_role('accounts')))
  with check (key = 'claims' and (select public.has_job_role('accounts')));

create table public.monthly_claims (
  id uuid primary key default gen_random_uuid(),
  -- Whoever starts it; never part of the insert grant, so it cannot be faked.
  profile_id uuid not null default auth.uid() references public.profiles (id),
  -- The first day of the claim month; dates after the cut-off day belong to the next month.
  month date not null check (month = date_trunc('month', month)::date),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'checked', 'returned', 'approved', 'paid')),
  -- The person's explanations or appeals.
  note text not null default '' check (char_length(note) <= 1000),
  -- The checker's findings, e.g. why a flagged item is justified or adjusted.
  remark text not null default '' check (char_length(remark) <= 1000),
  -- What the person must fix; the latest one, the log keeps every return.
  return_reason text check (return_reason = btrim(return_reason) and return_reason <> ''
    and char_length(return_reason) <= 500),
  original_receipts_received boolean not null default false,
  -- Section C: the month's approved OT and replacement leave in ringgit, frozen at submit.
  ot_original_amount numeric(12, 2) check (ot_original_amount >= 0),
  ot_amount numeric(12, 2) check (ot_amount >= 0),
  ot_adjustment_reason text check (ot_adjustment_reason = btrim(ot_adjustment_reason)
    and ot_adjustment_reason <> '' and char_length(ot_adjustment_reason) <= 300),
  created_at timestamptz not null default now(),
  unique (profile_id, month),
  check ((ot_original_amount is null) = (ot_amount is null)),
  check (ot_amount is not distinct from ot_original_amount or ot_adjustment_reason is not null),
  check (status <> 'returned' or return_reason is not null)
);

create table public.monthly_claim_expenses (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.monthly_claims (id) on delete cascade,
  spent_on date not null,
  expense_type text not null check (expense_type in (
    'petrol', 'toll', 'parking', 'outstation_meals', 'hotel', 'mileage', 'grab', 'others'
  )),
  description text not null check (description = btrim(description) and description <> ''
    and char_length(description) <= 300),
  -- Mileage only; its amount is km times the mileage rate, worked out by the database.
  km numeric(7, 1) check (km > 0),
  -- Hotel only, so the night rate can be held against the person's budget.
  nights smallint check (nights between 1 and 60),
  original_amount numeric(12, 2) not null check (original_amount > 0),
  amount numeric(12, 2) not null check (amount >= 0),
  adjustment_reason text check (adjustment_reason = btrim(adjustment_reason)
    and adjustment_reason <> '' and char_length(adjustment_reason) <= 300),
  adjusted_by uuid references public.profiles (id),
  adjusted_at timestamptz,
  -- R1, R2... on the printed form, given when the receipt is attached and never renumbered.
  receipt_no smallint check (receipt_no > 0),
  -- The receipt photo (D4); same path shape as src/lib/storage/attachment-rules.ts.
  receipt_path text unique
    check (char_length(receipt_path) <= 400
      and starts_with(receipt_path, 'claims/' || claim_id::text || '/')),
  receipt_file_name text check (char_length(receipt_file_name) between 1 and 200),
  receipt_content_type text check (receipt_content_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  unique (claim_id, receipt_no),
  check ((expense_type = 'mileage') = (km is not null)),
  check ((expense_type = 'hotel') = (nights is not null)),
  check (expense_type <> 'mileage' or receipt_path is null),
  check ((receipt_path is null) = (receipt_file_name is null)
    and (receipt_path is null) = (receipt_content_type is null)
    and (receipt_path is null) = (receipt_no is null)),
  check (amount = original_amount or adjustment_reason is not null),
  check ((adjusted_by is null) = (adjusted_at is null))
);

create index monthly_claim_expenses_claim_id_idx on public.monthly_claim_expenses (claim_id, spent_on);

create table public.monthly_claim_commissions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.monthly_claims (id) on delete cascade,
  mof_id uuid not null references public.mofs (id),
  -- The claim's person, copied so the double-claim index can see it.
  profile_id uuid not null references public.profiles (id),
  -- What the late-collection cut took off, shown on the line; zero when an appeal was approved.
  late_cut_amount numeric(12, 2) not null default 0 check (late_cut_amount >= 0),
  late_cut_waived boolean not null default false,
  -- Payable-now when the line was added.
  original_amount numeric(12, 2) not null check (original_amount > 0),
  amount numeric(12, 2) not null check (amount >= 0),
  adjustment_reason text check (adjustment_reason = btrim(adjustment_reason)
    and adjustment_reason <> '' and char_length(adjustment_reason) <= 300),
  adjusted_by uuid references public.profiles (id),
  adjusted_at timestamptz,
  -- True while the claim is submitted, checked or approved (demo clPendingFor); kept by
  -- sync_monthly_claim_pending().
  pending boolean not null default false,
  created_at timestamptz not null default now(),
  unique (claim_id, mof_id),
  check (amount = original_amount or adjustment_reason is not null),
  check ((adjusted_by is null) = (adjusted_at is null))
);

create index monthly_claim_commissions_mof_id_idx on public.monthly_claim_commissions (mof_id);

-- D2: the same commission cannot wait in two claims.
create unique index monthly_claim_commissions_one_pending_idx
  on public.monthly_claim_commissions (mof_id, profile_id)
  where pending;

create table public.monthly_claim_log (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.monthly_claims (id) on delete cascade,
  status text not null
    check (status in ('submitted', 'checked', 'returned', 'approved', 'paid')),
  note text,
  -- Empty when the service role made the change.
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

create index monthly_claim_log_claim_id_idx on public.monthly_claim_log (claim_id, changed_at);

-- Security definer: line policies look at the claim whatever its own policy lets them see.
create function public.can_see_monthly_claim(claim uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.monthly_claims c
    where c.id = claim
      and (
        c.profile_id = (select auth.uid())
        or public.has_job_role('md', 'accounts')
        or (public.has_job_role('director') and public.in_my_team(c.profile_id))
      )
  );
$$;

-- The person's own claim, while it is a draft or returned.
create function public.owns_open_monthly_claim(claim uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.monthly_claims c
    where c.id = claim
      and c.profile_id = (select auth.uid())
      and c.status in ('draft', 'returned')
  );
$$;

-- Someone else's claim the MD or HR & Accounts is checking or approving.
create function public.adjusts_monthly_claim(claim uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.monthly_claims c
    where c.id = claim
      and c.profile_id <> (select auth.uid())
      and c.status in ('submitted', 'checked', 'approved')
  ) and public.has_job_role('md', 'accounts');
$$;

revoke execute on function public.can_see_monthly_claim(uuid) from public, anon;
revoke execute on function public.owns_open_monthly_claim(uuid) from public, anon;
revoke execute on function public.adjusts_monthly_claim(uuid) from public, anon;
grant execute on function public.can_see_monthly_claim(uuid) to authenticated;
grant execute on function public.owns_open_monthly_claim(uuid) to authenticated;
grant execute on function public.adjusts_monthly_claim(uuid) to authenticated;

-- D1: the flow and who may change what, which RLS cannot express per column. Skipped when there
-- is no signed-in user (the service role, e.g. example data scripts).
create function public.guard_monthly_claim_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  mine boolean;
  manager boolean;
begin
  if me is null then
    return new;
  end if;
  mine := old.profile_id = me;
  manager := not mine and public.has_job_role('md', 'accounts');

  if new.status is distinct from old.status then
    if mine and old.status in ('draft', 'returned') and new.status = 'submitted' then
      null;
    elsif manager and old.status = 'submitted' and new.status = 'checked'
      and public.has_job_role('accounts') then
      null;
    elsif manager and old.status in ('submitted', 'checked')
      and new.status in ('approved', 'returned') then
      null;
    elsif manager and old.status = 'approved' and new.status = 'paid' then
      null;
    else
      raise exception 'A claim cannot go from % to % here.', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  if (new.remark, new.original_receipts_received, new.ot_amount, new.ot_adjustment_reason,
      new.return_reason)
    is distinct from (old.remark, old.original_receipts_received, old.ot_amount,
      old.ot_adjustment_reason, old.return_reason)
    and not (manager and old.status in ('submitted', 'checked', 'approved')) then
    raise exception 'Only HR & Accounts or the MD changes this, while the claim is with them.'
      using errcode = '42501';
  end if;

  if (new.note, new.ot_original_amount) is distinct from (old.note, old.ot_original_amount) then
    if not (mine and old.status in ('draft', 'returned')) then
      raise exception 'Only the person changes their claim, before it is submitted.'
        using errcode = '42501';
    end if;
    if new.ot_original_amount is distinct from old.ot_original_amount then
      new.ot_amount := new.ot_original_amount;
      new.ot_adjustment_reason := null;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_monthly_claim_write() from public, anon, authenticated;

create trigger guard_monthly_claim_write
  before update on public.monthly_claims
  for each row execute function public.guard_monthly_claim_write();

-- Logs each status change and marks the claim's commission lines pending or not. Security
-- definer: nobody writes the log or the pending flag directly.
create function public.after_monthly_claim_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.monthly_claim_log (claim_id, status, note, changed_by)
  values (
    new.id,
    new.status,
    case when new.status = 'returned' then new.return_reason end,
    (select auth.uid())
  );
  update public.monthly_claim_commissions
  set pending = new.status in ('submitted', 'checked', 'approved')
  where claim_id = new.id
    and pending is distinct from (new.status in ('submitted', 'checked', 'approved'));
  return null;
end;
$$;

revoke execute on function public.after_monthly_claim_status() from public, anon, authenticated;

create trigger after_monthly_claim_status
  after update of status on public.monthly_claims
  for each row
  when (new.status is distinct from old.status)
  execute function public.after_monthly_claim_status();

-- Shared by both line tables: the person's own write sets the claimed amount; a checker may
-- change only the amount and its reason, and is stamped. Pending flips by the status trigger
-- pass through.
create function public.guard_monthly_claim_line_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  adjustable constant text[] := array['amount', 'adjustment_reason', 'adjusted_by', 'adjusted_at'];
begin
  if me is null or (to_jsonb(new) - 'pending') = (to_jsonb(old) - 'pending') then
    return new;
  end if;

  if tg_table_name = 'monthly_claim_expenses' and public.owns_open_monthly_claim(old.claim_id) then
    new.adjustment_reason := null;
    new.adjusted_by := null;
    new.adjusted_at := null;
  elsif public.adjusts_monthly_claim(old.claim_id) then
    if (to_jsonb(new) - adjustable) <> (to_jsonb(old) - adjustable) then
      raise exception 'Only the amount and its reason can be adjusted.' using errcode = '42501';
    end if;
    new.adjusted_by := me;
    new.adjusted_at := now();
  else
    raise exception 'This line cannot be changed now.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_monthly_claim_line_write() from public, anon, authenticated;

create trigger guard_monthly_claim_expense_write
  before update on public.monthly_claim_expenses
  for each row execute function public.guard_monthly_claim_line_write();

create trigger guard_monthly_claim_commission_write
  before update on public.monthly_claim_commissions
  for each row execute function public.guard_monthly_claim_line_write();

-- Mileage is km times the rate; the claimed amount is what the person keyed in; a receipt gets
-- the claim's next number when it is first attached. Runs after the guard (trigger names sort),
-- so a checker's adjustment (adjusted_by set) is kept as entered.
create function public.prepare_monthly_claim_expense()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expense_type = 'mileage' and new.adjusted_by is null then
    new.amount := round(new.km * coalesce((
      select (value ->> 'mileageRatePerKm')::numeric from public.app_settings where key = 'claims'
    ), 0.6), 2);
  end if;
  if tg_op = 'INSERT' then
    new.original_amount := coalesce(new.original_amount, new.amount);
  end if;
  if (select auth.uid()) is not null and new.adjusted_by is null then
    new.original_amount := new.amount;
  end if;
  if new.receipt_path is null then
    new.receipt_no := null;
  elsif tg_op = 'INSERT' or old.receipt_no is null then
    new.receipt_no := coalesce((
      select max(receipt_no) from public.monthly_claim_expenses where claim_id = new.claim_id
    ), 0) + 1;
  end if;
  return new;
end;
$$;

revoke execute on function public.prepare_monthly_claim_expense() from public, anon, authenticated;

create trigger prepare_monthly_claim_expense
  before insert or update on public.monthly_claim_expenses
  for each row execute function public.prepare_monthly_claim_expense();

create trigger refuse_future_spent_on
  before insert or update of spent_on on public.monthly_claim_expenses
  for each row execute function public.refuse_future_date(
    'spent_on', 'You cannot claim for a day that has not come.');

-- A commission line is the claim's person on one order, for what is payable now (90%+ paid,
-- D2). Security definer: payable-now is not granted to the app.
create function public.prepare_monthly_claim_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.monthly_claims;
begin
  select * into claim from public.monthly_claims where id = new.claim_id;
  new.profile_id := claim.profile_id;
  new.pending := claim.status in ('submitted', 'checked', 'approved');
  if (select auth.uid()) is not null then
    new.original_amount := public.commission_payable_now(new.mof_id, claim.profile_id);
    if new.original_amount <= 0 then
      raise exception 'Nothing is payable on this order yet.' using errcode = 'check_violation';
    end if;
    new.amount := new.original_amount;
  end if;
  new.amount := coalesce(new.amount, new.original_amount);
  return new;
end;
$$;

revoke execute on function public.prepare_monthly_claim_commission() from public, anon, authenticated;

create trigger prepare_monthly_claim_commission
  before insert on public.monthly_claim_commissions
  for each row execute function public.prepare_monthly_claim_commission();

alter table public.monthly_claims enable row level security;
alter table public.monthly_claim_expenses enable row level security;
alter table public.monthly_claim_commissions enable row level security;
alter table public.monthly_claim_log enable row level security;

revoke all on table public.monthly_claims from anon, authenticated;
grant select, delete on table public.monthly_claims to authenticated;
grant insert (month, note) on table public.monthly_claims to authenticated;
grant update (status, note, remark, return_reason, original_receipts_received,
  ot_original_amount, ot_amount, ot_adjustment_reason)
  on table public.monthly_claims to authenticated;

revoke all on table public.monthly_claim_expenses from anon, authenticated;
grant select, delete on table public.monthly_claim_expenses to authenticated;
grant insert (claim_id, spent_on, expense_type, description, km, nights, amount,
  receipt_path, receipt_file_name, receipt_content_type)
  on table public.monthly_claim_expenses to authenticated;
grant update (spent_on, expense_type, description, km, nights, amount, adjustment_reason,
  receipt_path, receipt_file_name, receipt_content_type)
  on table public.monthly_claim_expenses to authenticated;

revoke all on table public.monthly_claim_commissions from anon, authenticated;
grant select, delete on table public.monthly_claim_commissions to authenticated;
grant insert (claim_id, mof_id, late_cut_amount, late_cut_waived)
  on table public.monthly_claim_commissions to authenticated;
grant update (amount, adjustment_reason) on table public.monthly_claim_commissions to authenticated;

revoke all on table public.monthly_claim_log from anon, authenticated;
grant select on table public.monthly_claim_log to authenticated;

create policy "monthly claims: own, md and accounts, director's team read"
  on public.monthly_claims for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select public.has_job_role('md', 'accounts'))
    or ((select public.has_job_role('director')) and public.in_my_team(profile_id))
  );

create policy "monthly claims: start your own"
  on public.monthly_claims for insert
  to authenticated
  with check (profile_id = (select auth.uid()) and status = 'draft');

-- The flow itself is checked by guard_monthly_claim_write().
create policy "monthly claims: the person or md and accounts change"
  on public.monthly_claims for update
  to authenticated
  using (
    (profile_id = (select auth.uid()) and status in ('draft', 'returned'))
    or (
      profile_id <> (select auth.uid())
      and status in ('submitted', 'checked', 'approved')
      and (select public.has_job_role('md', 'accounts'))
    )
  )
  with check (
    profile_id = (select auth.uid())
    or (profile_id <> (select auth.uid()) and (select public.has_job_role('md', 'accounts')))
  );

-- An empty draft is thrown away (demo clSubmitFor).
create policy "monthly claims: remove your own draft"
  on public.monthly_claims for delete
  to authenticated
  using (profile_id = (select auth.uid()) and status = 'draft');

create policy "monthly claim expenses: read with the claim"
  on public.monthly_claim_expenses for select
  to authenticated
  using (public.can_see_monthly_claim(claim_id));

create policy "monthly claim expenses: the person adds"
  on public.monthly_claim_expenses for insert
  to authenticated
  with check (public.owns_open_monthly_claim(claim_id));

create policy "monthly claim expenses: the person or a checker changes"
  on public.monthly_claim_expenses for update
  to authenticated
  using (public.owns_open_monthly_claim(claim_id) or public.adjusts_monthly_claim(claim_id))
  with check (public.owns_open_monthly_claim(claim_id) or public.adjusts_monthly_claim(claim_id));

create policy "monthly claim expenses: the person removes"
  on public.monthly_claim_expenses for delete
  to authenticated
  using (public.owns_open_monthly_claim(claim_id));

create policy "monthly claim commissions: read with the claim"
  on public.monthly_claim_commissions for select
  to authenticated
  using (public.can_see_monthly_claim(claim_id));

create policy "monthly claim commissions: the person adds"
  on public.monthly_claim_commissions for insert
  to authenticated
  with check (public.owns_open_monthly_claim(claim_id));

create policy "monthly claim commissions: a checker adjusts"
  on public.monthly_claim_commissions for update
  to authenticated
  using (public.adjusts_monthly_claim(claim_id))
  with check (public.adjusts_monthly_claim(claim_id));

create policy "monthly claim commissions: the person removes"
  on public.monthly_claim_commissions for delete
  to authenticated
  using (public.owns_open_monthly_claim(claim_id));

create policy "monthly claim log: read with the claim"
  on public.monthly_claim_log for select
  to authenticated
  using (public.can_see_monthly_claim(claim_id));

create policy "left people: no access"
  on public.monthly_claims as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.monthly_claim_expenses as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.monthly_claim_commissions as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.monthly_claim_log as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- D3: HR & Accounts also decides overtime, now that it is paid through the monthly claim. The
-- policy keeps its name because the migration guard refuses drop policy.
alter policy "ot claims: MD and Sales Director decide"
  on public.ot_claims
  using (
    status = 'pending'
    and profile_id <> (select auth.uid())
    and (select public.has_job_role('md', 'director', 'accounts'))
  )
  with check (
    profile_id <> (select auth.uid())
    and (select public.has_job_role('md', 'director', 'accounts'))
  );
