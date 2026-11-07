-- A company with no completed visit or site visit for 3 months (90 days) is released: any
-- salesperson may ask to take it over, and the MD or Sales Director decides. One request covers
-- the whole company (whole_company), and approving it makes the requester the owner of all the
-- company's customers. A company added in the last 90 days is not released. Nothing moves by
-- itself, and nothing is deleted: owners are replaced only when a request is approved.
--
-- This file adds the new pieces. The database rule that refuses a whole-company request while
-- the company is not released replaces an existing policy, so it is in the next file.

-- The same rule the app shows as "Released". Security definer so the answer does not depend on
-- which customers or activities the caller may read.
create function public.company_is_released(company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.companies c where c.id = company_is_released.company)
    and (select c.created_at from public.companies c where c.id = company_is_released.company)
      < now() - interval '90 days'
    and not exists (
      select 1
      from public.activities a
      join public.contacts k on k.id = a.contact_id
      where k.company_id = company_is_released.company
        and a.status = 'completed'
        and a.type in ('visit', 'site_visit')
        and a.starts_at >= now() - interval '90 days'
    );
$$;

revoke execute on function public.company_is_released(uuid) from public, anon;
grant execute on function public.company_is_released(uuid) to authenticated;

alter table public.ownership_requests
  add column whole_company boolean not null default false;

grant insert (whole_company) on table public.ownership_requests to authenticated;

-- Approve replaces the owners with the requester; for a whole-company request, on every
-- customer of the company that is not archived.
create or replace function public.decide_ownership_request(request uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_request public.ownership_requests;
  company uuid;
  target uuid;
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
    select c.company_id into company
    from public.contacts c where c.id = open_request.contact_id;

    for target in
      select k.id from public.contacts k
      where k.id = open_request.contact_id
        or (open_request.whole_company
          and k.company_id = company
          and k.archived_at is null)
    loop
      delete from public.contact_owners where contact_id = target;
      insert into public.contact_owners (contact_id, profile_id)
      values (target, open_request.requested_by);
    end loop;
  end if;

  update public.ownership_requests
  set status = case when approve then 'approved' else 'rejected' end,
      decided_by = (select auth.uid()),
      decided_at = now()
  where id = request;
end;
$$;
