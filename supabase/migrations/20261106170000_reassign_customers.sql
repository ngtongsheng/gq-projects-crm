-- The MD or Sales Director gives a customer, or every customer at a company, to one or two
-- salespeople in one step. Every change is written to ownership_changes (who, when, from whom,
-- to whom, why). Ownership requests still open on those customers are closed: approved when the
-- requester is among the new owners, rejected otherwise. Nothing is deleted except the old
-- owner rows, which the record keeps.

create table public.ownership_changes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id),
  changed_by uuid not null references public.profiles (id) default auth.uid(),
  from_owners uuid[] not null,
  to_owners uuid[] not null check (cardinality(to_owners) between 1 and 2),
  whole_company boolean not null default false,
  reason text not null check (reason = btrim(reason) and reason <> ''),
  created_at timestamptz not null default now()
);

create index ownership_changes_contact_id_idx on public.ownership_changes (contact_id);

alter table public.ownership_changes enable row level security;

-- Rows are written only by reassign_customers(); nobody signed in inserts, edits or deletes.
revoke all on table public.ownership_changes from anon, authenticated;
grant select on table public.ownership_changes to authenticated;

create policy "ownership changes: managers read"
  on public.ownership_changes for select
  to authenticated
  using ((select public.is_manager()));

-- Returns how many customers changed hands. Security definer so it can close the requests, with
-- the role check up front as in decide_ownership_request().
create function public.reassign_customers(
  contact uuid,
  new_owners uuid[],
  whole_company boolean,
  reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid;
  target uuid;
  before_owners uuid[];
  moved integer := 0;
  why text := btrim(coalesce(reassign_customers.reason, ''));
begin
  if not public.has_job_role('md', 'director') then
    raise exception 'Only the MD or Sales Director can reassign customers.'
      using errcode = '42501';
  end if;
  if why = '' then
    raise exception 'Give the reason for the change.' using errcode = '22023';
  end if;
  if reassign_customers.new_owners is null
    or cardinality(reassign_customers.new_owners) not between 1 and 2
    or (select count(distinct o) from unnest(reassign_customers.new_owners) as o)
      <> cardinality(reassign_customers.new_owners) then
    raise exception 'Choose one or two different owners.' using errcode = '22023';
  end if;

  select c.company_id into company
  from public.contacts c where c.id = reassign_customers.contact;
  if not found then
    raise exception 'Customer not found.' using errcode = 'P0002';
  end if;

  for target in
    select k.id from public.contacts k
    where k.archived_at is null
      and (k.id = reassign_customers.contact
        or (reassign_customers.whole_company and k.company_id = company))
    order by k.name
  loop
    select coalesce(array_agg(o.profile_id order by o.created_at), '{}')
      into before_owners
    from public.contact_owners o where o.contact_id = target;

    delete from public.contact_owners where contact_id = target;
    insert into public.contact_owners (contact_id, profile_id)
    select target, owner from unnest(reassign_customers.new_owners) as owner;

    insert into public.ownership_changes
      (contact_id, from_owners, to_owners, whole_company, reason)
    values (target, before_owners, reassign_customers.new_owners,
      reassign_customers.whole_company, why);

    update public.ownership_requests r
    set status = case when r.requested_by = any (reassign_customers.new_owners)
          then 'approved' else 'rejected' end,
        decided_by = (select auth.uid()),
        decided_at = now()
    where r.contact_id = target and r.status = 'pending';

    moved := moved + 1;
  end loop;

  return moved;
end;
$$;

revoke execute on function public.reassign_customers(uuid, uuid[], boolean, text)
  from public, anon;
grant execute on function public.reassign_customers(uuid, uuid[], boolean, text)
  to authenticated;
