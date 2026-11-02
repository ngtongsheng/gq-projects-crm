-- Paste-from-sheet import of companies and contacts (loop 03 D5).
-- Security invoker: every row goes through the caller's grants and RLS, and one
-- call is one transaction, so a failing row leaves nothing half-imported.
-- The app validates rows first; an update row carries "id" and only the
-- columns that were pasted, so absent keys keep the saved value.

create function public.import_companies(import_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
begin
  for r in select value from jsonb_array_elements(import_rows) loop
    if r ? 'id' then
      update public.companies c set
        name = case when r ? 'name' then r ->> 'name' else c.name end,
        company_type = case when r ? 'company_type' then r ->> 'company_type' else c.company_type end,
        rating = case when r ? 'rating' then (r ->> 'rating')::smallint else c.rating end,
        account_type = case when r ? 'account_type' then r ->> 'account_type' else c.account_type end,
        passed_by = case when r ? 'passed_by' then (r ->> 'passed_by')::uuid else c.passed_by end,
        address = case when r ? 'address' then r ->> 'address' else c.address end,
        notes = case when r ? 'notes' then r ->> 'notes' else c.notes end
      where c.id = (r ->> 'id')::uuid;
      if not found then
        raise exception 'Company % could not be updated.', r ->> 'id';
      end if;
    else
      insert into public.companies (name, company_type, rating, account_type, passed_by, address, notes)
      values (
        r ->> 'name',
        r ->> 'company_type',
        (r ->> 'rating')::smallint,
        r ->> 'account_type',
        (r ->> 'passed_by')::uuid,
        r ->> 'address',
        r ->> 'notes'
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.import_companies(jsonb) from public, anon;
grant execute on function public.import_companies(jsonb) to authenticated;

-- "owners", when present, replaces the contact's owners (the creator trigger
-- makes the importer the owner first). Only the MD and Sales Director may.
create function public.import_contacts(import_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  contact uuid;
begin
  for r in select value from jsonb_array_elements(import_rows) loop
    if r ? 'id' then
      contact := (r ->> 'id')::uuid;
      update public.contacts c set
        company_id = case when r ? 'company_id' then (r ->> 'company_id')::uuid else c.company_id end,
        name = case when r ? 'name' then r ->> 'name' else c.name end,
        mobile = case when r ? 'mobile' then r ->> 'mobile' else c.mobile end,
        title = case when r ? 'title' then r ->> 'title' else c.title end,
        rating = case when r ? 'rating' then (r ->> 'rating')::smallint else c.rating end,
        account_type = case when r ? 'account_type' then r ->> 'account_type' else c.account_type end,
        passed_by = case when r ? 'passed_by' then (r ->> 'passed_by')::uuid else c.passed_by end,
        notes = case when r ? 'notes' then r ->> 'notes' else c.notes end
      where c.id = contact;
      if not found then
        raise exception 'Contact % could not be updated.', contact;
      end if;
    else
      insert into public.contacts (company_id, name, mobile, title, rating, account_type, passed_by, notes)
      values (
        (r ->> 'company_id')::uuid,
        r ->> 'name',
        r ->> 'mobile',
        r ->> 'title',
        (r ->> 'rating')::smallint,
        r ->> 'account_type',
        (r ->> 'passed_by')::uuid,
        r ->> 'notes'
      )
      returning id into contact;
    end if;

    if r ? 'owners' then
      delete from public.contact_owners where contact_id = contact;
      insert into public.contact_owners (contact_id, profile_id)
      select contact, owner::uuid from jsonb_array_elements_text(r -> 'owners') as owner;
    end if;
  end loop;
end;
$$;

revoke execute on function public.import_contacts(jsonb) from public, anon;
grant execute on function public.import_contacts(jsonb) to authenticated;
