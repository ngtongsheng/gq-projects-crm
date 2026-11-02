-- A salesperson asks to own someone else's customer; the MD or Sales Director
-- approves (owners are replaced by the requester) or rejects (loop 03 task 07).

create table public.ownership_requests (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id),
  requested_by uuid not null references public.profiles (id) default auth.uid(),
  reason text not null check (reason = btrim(reason) and reason <> ''),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending') = (decided_by is null and decided_at is null))
);

-- One open request per person per customer.
create unique index ownership_requests_one_pending_key
  on public.ownership_requests (contact_id, requested_by)
  where status = 'pending';

create index ownership_requests_requested_by_idx
  on public.ownership_requests (requested_by);

alter table public.ownership_requests enable row level security;

-- Decisions go through decide_ownership_request(); nobody updates rows directly.
revoke all on table public.ownership_requests from anon, authenticated;
grant select on table public.ownership_requests to authenticated;
grant insert (contact_id, reason) on table public.ownership_requests to authenticated;

create policy "ownership requests: requester and managers read"
  on public.ownership_requests for select
  to authenticated
  using (requested_by = (select auth.uid()) or (select public.is_manager()));

create policy "ownership requests: salespeople ask for customers they do not own"
  on public.ownership_requests for insert
  to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'
    and (select public.has_job_role('bd', 'sales'))
    and not public.is_contact_owner(contact_id)
  );

-- Approve replaces the owners with the requester, as the prototype's "Change owner" does.
create function public.decide_ownership_request(request uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_request public.ownership_requests;
begin
  if not public.has_job_role('md', 'director') then
    raise exception 'Only the MD or Sales Director can decide ownership requests.'
      using errcode = '42501';
  end if;

  select * into open_request
  from public.ownership_requests
  where id = request and status = 'pending'
  for update;
  if not found then
    raise exception 'This request was already decided or does not exist.'
      using errcode = 'P0002';
  end if;

  if approve then
    delete from public.contact_owners where contact_id = open_request.contact_id;
    insert into public.contact_owners (contact_id, profile_id)
    values (open_request.contact_id, open_request.requested_by);
  end if;

  update public.ownership_requests
  set status = case when approve then 'approved' else 'rejected' end,
      decided_by = (select auth.uid()),
      decided_at = now()
  where id = request;
end;
$$;

revoke execute on function public.decide_ownership_request(uuid, boolean) from public, anon;
grant execute on function public.decide_ownership_request(uuid, boolean) to authenticated;
