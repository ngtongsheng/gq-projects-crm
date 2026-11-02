-- Companies and their contacts (customers), with ownership (loop 03 D3).
-- Everyone signed in reads all. Owners and the MD/Sales Director edit. HR & Accounts
-- is read-only here, as in the prototype. Nothing is deleted: contacts are archived.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and name <> ''),
  company_type text not null default 'designer'
    check (company_type in ('designer', 'contractor', 'main_contractor', 'architect',
      'consultant', 'developer', 'dealer', 'corporate', 'others')),
  rating smallint not null default 3 check (rating between 1 and 5),
  -- Null means "not fixed": the salesperson chooses per project.
  account_type text check (account_type in ('own', 'pass_down', 'company')),
  passed_by uuid references public.profiles (id),
  address text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check ((account_type is not distinct from 'pass_down') = (passed_by is not null))
);

create unique index companies_name_key on public.companies (lower(name));

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null check (name = btrim(name) and name <> ''),
  -- Digits only with the 60 country code; the app normalises before saving.
  mobile text not null unique check (mobile ~ '^60[0-9]{8,10}$'),
  title text,
  rating smallint not null default 3 check (rating between 1 and 5),
  account_type text not null default 'own'
    check (account_type in ('own', 'pass_down', 'company')),
  passed_by uuid references public.profiles (id),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check ((account_type = 'pass_down') = (passed_by is not null))
);

create index contacts_company_id_idx on public.contacts (company_id);

-- Up to two salespeople own a contact (PIC + support).
create table public.contact_owners (
  contact_id uuid not null references public.contacts (id),
  profile_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (contact_id, profile_id)
);

create index contact_owners_profile_id_idx on public.contact_owners (profile_id);

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_owners enable row level security;

-- Column grants keep id, created_at and created_by at their defaults.
revoke all on table public.companies from anon, authenticated;
grant select on table public.companies to authenticated;
grant insert (name, company_type, rating, account_type, passed_by, address, notes),
  update (name, company_type, rating, account_type, passed_by, address, notes)
  on table public.companies to authenticated;

revoke all on table public.contacts from anon, authenticated;
grant select on table public.contacts to authenticated;
grant insert (company_id, name, mobile, title, rating, account_type, passed_by, notes)
  on table public.contacts to authenticated;
grant update (company_id, name, mobile, title, rating, account_type, passed_by, notes, archived_at)
  on table public.contacts to authenticated;

-- Delete here is only for replacing owners; the contact itself is never deleted.
revoke all on table public.contact_owners from anon, authenticated;
grant select, insert (contact_id, profile_id), delete
  on table public.contact_owners to authenticated;

-- For this and later tables (activities, projects) that follow contact ownership.
create function public.is_contact_owner(contact uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contact_owners
    where contact_id = contact and profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_contact_owner(uuid) from public, anon;
grant execute on function public.is_contact_owner(uuid) to authenticated;

create policy "companies: read all"
  on public.companies for select
  to authenticated
  using (true);

create policy "companies: add unless read-only"
  on public.companies for insert
  to authenticated
  with check (not (select public.has_job_role('accounts')));

create policy "companies: md and director edit"
  on public.companies for update
  to authenticated
  using ((select public.has_job_role('md', 'director')))
  with check ((select public.has_job_role('md', 'director')));

create policy "contacts: read all"
  on public.contacts for select
  to authenticated
  using (true);

create policy "contacts: add unless read-only"
  on public.contacts for insert
  to authenticated
  with check (not (select public.has_job_role('accounts')));

create policy "contacts: owners, md and director edit"
  on public.contacts for update
  to authenticated
  using (public.is_contact_owner(id) or (select public.has_job_role('md', 'director')))
  with check (public.is_contact_owner(id) or (select public.has_job_role('md', 'director')));

create policy "contact owners: read all"
  on public.contact_owners for select
  to authenticated
  using (true);

create policy "contact owners: md and director add"
  on public.contact_owners for insert
  to authenticated
  with check ((select public.has_job_role('md', 'director')));

create policy "contact owners: md and director remove"
  on public.contact_owners for delete
  to authenticated
  using ((select public.has_job_role('md', 'director')));

-- Whoever adds a contact owns it. Security definer: callers cannot insert owners themselves.
create function public.add_contact_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    insert into public.contact_owners (contact_id, profile_id)
    values (new.id, (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke execute on function public.add_contact_creator_as_owner() from public, anon, authenticated;

create trigger on_contact_created
  after insert on public.contacts
  for each row execute function public.add_contact_creator_as_owner();

create function public.limit_contact_owners()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.contact_owners where contact_id = new.contact_id) >= 2 then
    raise exception 'A contact can have at most two owners.';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_contact_owners() from public, anon, authenticated;

create trigger before_contact_owner_added
  before insert on public.contact_owners
  for each row execute function public.limit_contact_owners();
