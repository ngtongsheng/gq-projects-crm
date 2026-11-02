-- Sales pipeline projects for a customer (loop 03 task 10). Everyone signed in reads.
-- The person in charge (PIC) or the supporting salesperson edits; the MD and Sales
-- Director edit anyone's. HR & Accounts is read-only here, as on customers. Nothing is
-- deleted: a project that falls through moves to Lost or On Hold.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id),
  name text not null check (name = btrim(name) and name <> ''),
  lead_source text not null
    check (lead_source in ('archidex', 'social_media', 'website_google', 'walk_in_showroom',
      'referral', 'id_architect', 'developer_main_contractor', 'tender_portal',
      'existing_customer', 'exhibition_event', 'cold_call')),
  stage text not null default 'lead'
    check (stage in ('lead', 'quotation_sent', 'sample_mockup', 'follow_up', 'negotiation',
      'awarded', 'lost', 'on_hold')),
  qty_sqft numeric(12,2) not null default 0 check (qty_sqft >= 0),
  value numeric(14,2) not null default 0 check (value >= 0),
  pic_id uuid not null references public.profiles (id),
  support_id uuid references public.profiles (id) check (support_id is distinct from pic_id),
  passed_by uuid references public.profiles (id),
  commission_type text not null default 'own'
    check (commission_type in ('own', 'pass_down', 'company')),
  next_action text,
  next_action_date date,
  notes text,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  check ((commission_type = 'pass_down') = (passed_by is not null))
);

create index projects_contact_id_idx on public.projects (contact_id);
create index projects_pic_id_idx on public.projects (pic_id);
create index projects_stage_idx on public.projects (stage);

-- Guards that RLS cannot express: who may touch money-related columns, and the clocks.
-- Skipped when there is no signed-in user (the service role, e.g. example data scripts).
create function public.guard_project_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  customer public.contacts;
begin
  new.updated_at = now();

  if tg_op = 'INSERT' then
    new.stage_changed_at = now();
  elsif new.stage is distinct from old.stage then
    new.stage_changed_at = now();
  else
    new.stage_changed_at = old.stage_changed_at;
  end if;

  if (select auth.uid()) is null or (select public.has_job_role('md', 'director')) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A salesperson is the PIC of what they add, on the customer's commission type.
    select * into customer from public.contacts where id = new.contact_id;
    new.pic_id = (select auth.uid());
    new.commission_type = customer.account_type;
    new.passed_by = customer.passed_by;
  elsif new.pic_id is distinct from old.pic_id
    or new.commission_type is distinct from old.commission_type
    or new.passed_by is distinct from old.passed_by then
    raise exception 'Only the MD or Sales Director can change the PIC or commission type.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_project_write() from public, anon, authenticated;

create trigger on_project_written
  before insert or update on public.projects
  for each row execute function public.guard_project_write();

alter table public.projects enable row level security;

-- Column grants keep id, contact_id and the audit columns fixed after insert.
revoke all on table public.projects from anon, authenticated;
grant select on table public.projects to authenticated;
grant insert (contact_id, name, lead_source, stage, qty_sqft, value, pic_id, support_id,
  passed_by, commission_type, next_action, next_action_date, notes)
  on table public.projects to authenticated;
grant update (name, lead_source, stage, qty_sqft, value, pic_id, support_id, passed_by,
  commission_type, next_action, next_action_date, notes)
  on table public.projects to authenticated;

create policy "projects: read all"
  on public.projects for select
  to authenticated
  using (true);

-- A salesperson registers a project for a customer they own, as its PIC. The MD and
-- Sales Director register for anyone.
create policy "projects: owners register their own"
  on public.projects for insert
  to authenticated
  with check (
    (select public.has_job_role('md', 'director'))
    or (
      (select public.has_job_role('bd', 'sales'))
      and pic_id = (select auth.uid())
      and public.is_contact_owner(contact_id)
    )
  );

create policy "projects: pic, support, md and director edit"
  on public.projects for update
  to authenticated
  using (
    (select public.has_job_role('md', 'director'))
    or (
      (select public.has_job_role('bd', 'sales'))
      and (select auth.uid()) in (pic_id, support_id)
    )
  )
  with check (
    (select public.has_job_role('md', 'director'))
    or (
      (select public.has_job_role('bd', 'sales'))
      and (select auth.uid()) in (pic_id, support_id)
    )
  );
