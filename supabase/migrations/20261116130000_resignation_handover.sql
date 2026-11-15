-- Loop 16 task 07: resignation handover (D5). When someone leaves, an admin hands their customers
-- and open projects to one person. hand_over_work() moves them in one transaction and records each
-- move in handover_items, shown on both people. Commission is untouched: the projects keep their
-- commission type and passed_by, and every MOF keeps its salespeople.

create table public.handover_items (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id),
  to_id uuid not null references public.profiles (id) check (to_id <> from_id),
  contact_id uuid references public.contacts (id),
  project_id uuid references public.projects (id),
  handed_over_at timestamptz not null default now(),
  handed_over_by uuid not null references public.profiles (id),
  check ((contact_id is null) <> (project_id is null))
);

create index handover_items_from_id_idx on public.handover_items (from_id);
create index handover_items_to_id_idx on public.handover_items (to_id);

alter table public.handover_items enable row level security;

-- Written only by hand_over_work(); the list is read on People, which is the admins' page.
revoke all on table public.handover_items from anon, authenticated;
grant select on table public.handover_items to authenticated;

create policy "handover items: admins read"
  on public.handover_items for select to authenticated
  using ((select public.is_admin()));

-- Same rule as every table (loop 11): a person who has left reads and writes nothing.
create policy "left people: no access"
  on public.handover_items as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- The PIC guard lets hand_over_work() change PICs for any admin, not only the MD or Sales
-- Director. The flag is transaction-local and set only inside that function; the API cannot set it.
create or replace function public.guard_project_write()
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

  if (select auth.uid()) is null
    or (select public.has_job_role('md', 'director'))
    or current_setting('gqp.handover', true) = 'on' then
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

-- Moves everything at once and returns how many customers and projects moved.
-- Open projects are every stage but Awarded and Lost: On Hold can still restart.
create function public.hand_over_work(leaver uuid, recipient uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can hand over work.' using errcode = '42501';
  end if;
  if leaver = recipient then
    raise exception 'Choose someone else to receive the work.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = recipient and active) then
    raise exception 'Choose someone who still works here.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = leaver and not active) then
    raise exception 'Mark them as left before handing over their work.' using errcode = '55000';
  end if;

  insert into public.handover_items (from_id, to_id, contact_id, handed_over_by)
  select leaver, recipient, contact_id, (select auth.uid())
  from public.contact_owners
  where profile_id = leaver;

  insert into public.handover_items (from_id, to_id, project_id, handed_over_by)
  select leaver, recipient, id, (select auth.uid())
  from public.projects
  where leaver in (pic_id, support_id) and stage not in ('awarded', 'lost');

  get diagnostics moved = row_count;
  moved := moved + (
    select count(*) from public.contact_owners where profile_id = leaver
  );

  -- Where the recipient already owns the customer, the leaver's row simply goes.
  update public.contact_owners co
  set profile_id = recipient
  where co.profile_id = leaver
    and not exists (
      select 1 from public.contact_owners o
      where o.contact_id = co.contact_id and o.profile_id = recipient
    );
  delete from public.contact_owners where profile_id = leaver;

  perform set_config('gqp.handover', 'on', true);
  -- A project's PIC and support differ, so the recipient stops being support when made PIC.
  update public.projects
  set pic_id = recipient,
      support_id = nullif(support_id, recipient)
  where pic_id = leaver and stage not in ('awarded', 'lost');
  update public.projects
  set support_id = case when pic_id = recipient then null else recipient end
  where support_id = leaver and stage not in ('awarded', 'lost');
  perform set_config('gqp.handover', '', true);

  return moved;
end;
$$;

revoke execute on function public.hand_over_work(uuid, uuid) from public, anon;
grant execute on function public.hand_over_work(uuid, uuid) to authenticated;
