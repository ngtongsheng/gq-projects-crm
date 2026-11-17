-- Loop 25 task 06: custom samples (demo vTuft, D11). Hand-tufted samples the office lends to
-- salespeople, separate from the stock `samples` table. A sample is Available, On loan,
-- Returned - to confirm (the borrower marked it returned) or Given away (final).
--
-- Who (demo 3.1):
--   readers   everyone with the page by default: all but Site Supervisors
--   keepers   md, designer, support, ssup, marketing, director (demo canTfAdmin) record, edit and
--             delete samples, confirm or deny a return, take one back directly, give any away
--   borrowers sellers (sales, bd, director, or `sells`) and the MD (demo canTfBorrow)
-- HR & Accounts reads only. The current borrower marks their loan returned and may give the
-- sample away.

-- Records, edits, deletes and confirms returns (demo canTfAdmin).
create function public.keeps_custom_samples()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_job_role('md', 'designer', 'support', 'ssup', 'marketing', 'director');
$$;

revoke execute on function public.keeps_custom_samples() from public, anon;
grant execute on function public.keeps_custom_samples() to authenticated;

-- Lends to a salesperson (demo isSeller). HR & Accounts is read-only and Site Supervisors do not
-- open the page, even when they also sell.
create function public.sells_custom_samples(person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = person and active
      and (job_role in ('sales', 'bd', 'director') or (sells and job_role not in ('accounts', 'site')))
  );
$$;

revoke execute on function public.sells_custom_samples(uuid) from public, anon;
grant execute on function public.sells_custom_samples(uuid) to authenticated;

create table public.custom_samples (
  id uuid primary key default gen_random_uuid(),
  -- Blank means the next TS-### (guard_custom_sample_write).
  code text not null unique
    check (code = btrim(code) and code <> '' and char_length(code) <= 40),
  received_on date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  design_name text not null
    check (design_name = btrim(design_name) and design_name <> '' and char_length(design_name) <= 200),
  design_no text not null
    check (design_no = btrim(design_no) and design_no <> '' and char_length(design_no) <= 100),
  supplier text check (supplier = btrim(supplier) and supplier <> '' and char_length(supplier) <= 200),
  size text check (size = btrim(size) and size <> '' and char_length(size) <= 100),
  qty integer not null default 1 check (qty >= 1),
  -- custom-samples/<sample id>/<file>, a photo only; same path shape as
  -- src/lib/storage/attachment-rules.ts. The id is chosen before the upload, like hr-policies.
  photo_path text unique
    check (char_length(photo_path) <= 400
      and starts_with(photo_path, 'custom-samples/' || id::text || '/')
      and photo_path ~ '\.(jpe?g|png|webp)$'),
  notes text check (notes = btrim(notes) and notes <> '' and char_length(notes) <= 1000),
  recorded_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Given away (demo x.gift): final, stamped by guard_custom_sample_write.
  given_on date,
  given_to text check (given_to = btrim(given_to) and given_to <> '' and char_length(given_to) <= 200),
  gift_reason text check (char_length(btrim(gift_reason)) >= 5 and char_length(gift_reason) <= 500),
  given_by uuid references public.profiles (id),
  check (
    (given_on is null) = (given_to is null)
    and (given_on is null) = (gift_reason is null)
    and (given_on is null) = (given_by is null)
  )
);

-- One loan of a sample to a salesperson (demo x.loans[]).
create table public.custom_sample_loans (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.custom_samples (id),
  salesperson_id uuid not null default auth.uid() references public.profiles (id),
  -- Free text like the demo: a salesperson may lend for a prospect who is not a customer yet.
  customer text not null
    check (customer = btrim(customer) and customer <> '' and char_length(customer) <= 200),
  project text check (project = btrim(project) and project <> '' and char_length(project) <= 200),
  out_on date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  -- out_on + the loan days setting at the time of borrowing; a later setting change leaves it.
  due_on date not null,
  -- The borrower's "I've returned it" (demo retAt).
  returned_marked_on date,
  back_on date,
  back_by uuid references public.profiles (id),
  given_away boolean not null default false,
  -- Each "Not received" an office keeper answered to a marked return (demo log).
  not_received_on date[] not null default '{}',
  lent_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check (due_on >= out_on),
  check ((back_on is null) = (back_by is null)),
  check (not given_away or back_on is not null)
);

create index custom_sample_loans_sample_idx on public.custom_sample_loans (sample_id);

-- One open loan per sample.
create unique index custom_sample_loans_one_open_idx
  on public.custom_sample_loans (sample_id) where back_on is null;

-- Has the sample on an open loan now (demo: the current borrower, loan.who).
create function public.borrows_custom_sample(sample uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.custom_sample_loans
    where sample_id = sample and back_on is null and salesperson_id = (select auth.uid())
  );
$$;

revoke execute on function public.borrows_custom_sample(uuid) from public, anon;
grant execute on function public.borrows_custom_sample(uuid) to authenticated;

-- The loan period in days (demo tuftCfg.days). Existing loans keep their due date.
alter table public.app_settings
  add constraint app_settings_custom_samples_check
  check (case
    when key <> 'customSamples' then true
    when jsonb_typeof(value) is distinct from 'object'
      or jsonb_typeof(value -> 'loanDays') is distinct from 'number' then false
    else (value ->> 'loanDays')::numeric between 1 and 365
      and mod((value ->> 'loanDays')::numeric, 1) = 0 end);

insert into public.app_settings (key, value) values ('customSamples', '{"loanDays": 14}')
on conflict (key) do nothing;

-- The page's Settings is for the keepers; the existing policies already let the MD and admins
-- write any setting.
create policy "app_settings: custom sample keepers add their setting"
  on public.app_settings for insert
  to authenticated
  with check (key = 'customSamples' and (select public.keeps_custom_samples()));

create policy "app_settings: custom sample keepers change their setting"
  on public.app_settings for update
  to authenticated
  using (key = 'customSamples' and (select public.keeps_custom_samples()))
  with check (key = 'customSamples' and (select public.keeps_custom_samples()));

-- The next code (demo: highest TS number + 1), and who may change which column: record columns
-- are for keepers; the gift is for keepers or the current borrower, once.
create function public.guard_custom_sample_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  today constant date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  next_number integer;
begin
  if tg_op = 'INSERT' then
    if new.code is null then
      select coalesce(max(substring(code from '^TS-([0-9]+)$')::integer), 0) + 1
        into next_number
        from public.custom_samples;
      new.code := 'TS-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0');
    end if;
    return new;
  end if;

  if me is null then
    return new;
  end if;

  if old.given_on is not null then
    raise exception 'A given-away sample cannot be changed.' using errcode = '42501';
  end if;

  if (new.code, new.received_on, new.design_name, new.design_no, new.supplier, new.size, new.qty,
      new.photo_path, new.notes)
    is distinct from (old.code, old.received_on, old.design_name, old.design_no, old.supplier,
      old.size, old.qty, old.photo_path, old.notes)
    and not public.keeps_custom_samples() then
    raise exception 'Only the office records custom samples.' using errcode = '42501';
  end if;

  if (new.given_to, new.gift_reason) is distinct from (old.given_to, old.gift_reason) then
    if not public.keeps_custom_samples() and not public.borrows_custom_sample(old.id) then
      raise exception 'Only the office or the borrower gives a sample away.'
        using errcode = '42501';
    end if;
    new.given_on := today;
    new.given_by := me;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_custom_sample_write() from public, anon, authenticated;

create trigger guard_custom_sample_write
  before insert or update on public.custom_samples
  for each row execute function public.guard_custom_sample_write();

-- Giving a sample away closes its open loan (demo: back today, gift true).
create function public.close_loan_on_gift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.custom_sample_loans
  set given_away = true
  where sample_id = new.id and back_on is null;
  return null;
end;
$$;

revoke execute on function public.close_loan_on_gift() from public, anon, authenticated;

create trigger close_loan_on_gift
  after update on public.custom_samples
  for each row when (old.given_on is null and new.given_on is not null)
  execute function public.close_loan_on_gift();

-- Borrowing and the two-step return (demo 3.5, 3.6). Security definer: a salesperson cannot
-- read another person's profile or the settings rules themselves.
create function public.guard_custom_sample_loan_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  today constant date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  keeper boolean;
  sample public.custom_samples;
begin
  select * into sample from public.custom_samples where id = new.sample_id;

  if tg_op = 'INSERT' then
    if sample.given_on is not null then
      raise exception 'This sample was given away.' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.custom_sample_loans
      where sample_id = new.sample_id and back_on is null
    ) then
      raise exception 'Already on loan.' using errcode = '23505';
    end if;
    -- Demo: a seller borrows for themselves; the MD picks the salesperson.
    if me is not null and not public.sells_custom_samples(new.salesperson_id) then
      raise exception 'Only a salesperson borrows a custom sample.' using errcode = '42501';
    end if;
    if me is not null and public.sells_custom_samples(me) and new.salesperson_id <> me then
      raise exception 'A salesperson borrows for themselves.' using errcode = '42501';
    end if;
    new.due_on := new.out_on + coalesce(
      (select (value ->> 'loanDays')::integer from public.app_settings where key = 'customSamples'),
      14
    );
    return new;
  end if;

  if new.given_away and not old.given_away then
    if sample.given_on is null then
      raise exception 'Give the sample away instead.' using errcode = '42501';
    end if;
    new.back_on := today;
    new.back_by := sample.given_by;
    return new;
  end if;

  if me is null then
    return new;
  end if;

  if old.back_on is not null then
    raise exception 'A closed loan cannot be changed.' using errcode = '42501';
  end if;

  keeper := public.keeps_custom_samples();

  if new.returned_marked_on is distinct from old.returned_marked_on then
    if old.returned_marked_on is null then
      if old.salesperson_id <> me then
        raise exception 'Only the borrower marks the sample returned.' using errcode = '42501';
      end if;
      new.returned_marked_on := today;
    elsif new.returned_marked_on is null then
      -- Not received: back to On loan, and noted.
      if not keeper then
        raise exception 'Only the office answers a return.' using errcode = '42501';
      end if;
      new.not_received_on := old.not_received_on || today;
    else
      new.returned_marked_on := old.returned_marked_on;
    end if;
  end if;

  if new.back_on is distinct from old.back_on then
    if not keeper then
      raise exception 'Only the office takes a sample back.' using errcode = '42501';
    end if;
    new.back_on := today;
    new.back_by := me;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_custom_sample_loan_write() from public, anon, authenticated;

create trigger guard_custom_sample_loan_write
  before insert or update on public.custom_sample_loans
  for each row execute function public.guard_custom_sample_loan_write();

alter table public.custom_samples enable row level security;
alter table public.custom_sample_loans enable row level security;

revoke all on table public.custom_samples from anon, authenticated;
revoke all on table public.custom_sample_loans from anon, authenticated;

grant select, delete on table public.custom_samples to authenticated;
grant insert (id, code, received_on, design_name, design_no, supplier, size, qty, photo_path, notes)
  on table public.custom_samples to authenticated;
grant update (code, received_on, design_name, design_no, supplier, size, qty, photo_path, notes,
  given_to, gift_reason)
  on table public.custom_samples to authenticated;

grant select on table public.custom_sample_loans to authenticated;
grant insert (sample_id, salesperson_id, customer, project, out_on)
  on table public.custom_sample_loans to authenticated;
grant update (returned_marked_on, back_on) on table public.custom_sample_loans to authenticated;

-- Page access default: everyone but Site Supervisors (src/lib/auth/pages.ts).
create policy "custom samples: all but site read"
  on public.custom_samples for select
  to authenticated
  using (not (select public.has_job_role('site')));

create policy "custom samples: keepers record"
  on public.custom_samples for insert
  to authenticated
  with check ((select public.keeps_custom_samples()));

-- Which columns is checked by guard_custom_sample_write().
create policy "custom samples: keepers or the borrower change"
  on public.custom_samples for update
  to authenticated
  using (
    given_on is null
    and ((select public.keeps_custom_samples()) or public.borrows_custom_sample(id))
  )
  with check ((select public.keeps_custom_samples()) or public.borrows_custom_sample(id));

create policy "custom samples: keepers delete one never lent or given"
  on public.custom_samples for delete
  to authenticated
  using (
    (select public.keeps_custom_samples())
    and given_on is null
    and not exists (
      select 1 from public.custom_sample_loans l where l.sample_id = custom_samples.id
    )
  );

create policy "custom sample loans: all but site read"
  on public.custom_sample_loans for select
  to authenticated
  using (not (select public.has_job_role('site')));

create policy "custom sample loans: sellers and the md borrow"
  on public.custom_sample_loans for insert
  to authenticated
  with check (
    lent_by = (select auth.uid())
    and ((select public.sells_custom_samples((select auth.uid()))) or (select public.has_job_role('md')))
  );

-- Which step is checked by guard_custom_sample_loan_write().
create policy "custom sample loans: the borrower or keepers return"
  on public.custom_sample_loans for update
  to authenticated
  using (
    back_on is null
    and (salesperson_id = (select auth.uid()) or (select public.keeps_custom_samples()))
  )
  with check (salesperson_id = (select auth.uid()) or (select public.keeps_custom_samples()));

create policy "left people: no access"
  on public.custom_samples as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.custom_sample_loans as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- custom-samples/<sample id>: the photo, added by a keeper. Role only, like hr-policies: the
-- sample is saved after the upload when it is new.
create or replace function public.can_attach(area text, record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active() and case area
    when 'leave' then exists (
      select 1 from public.leave_requests r
      where r.id = record_id
        and (r.person_id = (select auth.uid()) or public.has_job_role('md', 'accounts'))
    )
    when 'tasks' then
      public.assigned_task(record_id) or public.works_on_task(record_id)
    when 'hr-policies' then
      public.has_job_role('md', 'accounts')
    when 'custom-samples' then
      public.keeps_custom_samples()
    else false
  end;
$$;
