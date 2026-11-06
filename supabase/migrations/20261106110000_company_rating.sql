-- The rating says how much a company matters, so it belongs to the company, not to each
-- designer there. Every company takes the highest rating among its current customers (a
-- company without customers keeps its own). contacts.rating stays in the table, unused and
-- nothing is deleted; the forms and imports stop writing it, so new customers get its default.
update public.companies c
set rating = best.rating
from (
  select company_id, max(rating) as rating
  from public.contacts
  group by company_id
) best
where best.company_id = c.id
  and c.rating is distinct from best.rating;

-- save_contact: the customer no longer carries a rating. An existing company is rated when
-- the company object holds only a rating (the MD and Sales Director; RLS refuses anyone else).
create or replace function public.save_contact(
  contact_id uuid,
  contact jsonb,
  company jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  posted public.contacts;
  posted_company public.companies;
  cid uuid := save_contact.contact_id;
  company_ref uuid;
begin
  posted := jsonb_populate_record(null::public.contacts, save_contact.contact);
  company_ref := posted.company_id;

  if jsonb_typeof(save_contact.company) = 'object' then
    posted_company := jsonb_populate_record(null::public.companies, save_contact.company);
    if save_contact.company ? 'name' then
      insert into public.companies (name, company_type, rating)
      values (posted_company.name, posted_company.company_type, posted_company.rating)
      returning id into company_ref;
    else
      update public.companies set rating = posted_company.rating where id = company_ref;
      if not found then
        raise exception 'Only the MD or the Sales Director can change a company''s rating.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if cid is null then
    insert into public.contacts (company_id, name, mobile, title, account_type,
      passed_by, notes)
    values (company_ref, posted.name, posted.mobile, posted.title,
      posted.account_type, posted.passed_by, posted.notes)
    returning id into cid;
  else
    update public.contacts c set
      company_id = company_ref,
      name = posted.name,
      mobile = posted.mobile,
      title = posted.title,
      account_type = posted.account_type,
      passed_by = posted.passed_by,
      notes = posted.notes
    where c.id = cid;
    if not found then
      raise exception 'Only the owners, the MD or the Sales Director can change this customer.'
        using errcode = '42501';
    end if;
  end if;

  return cid;
end;
$$;

-- import_contacts: same, no rating column.
create or replace function public.import_contacts(import_rows jsonb)
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
        account_type = case when r ? 'account_type' then r ->> 'account_type' else c.account_type end,
        passed_by = case when r ? 'passed_by' then (r ->> 'passed_by')::uuid else c.passed_by end,
        notes = case when r ? 'notes' then r ->> 'notes' else c.notes end
      where c.id = contact;
      if not found then
        raise exception 'Contact % could not be updated.', contact;
      end if;
    else
      insert into public.contacts (company_id, name, mobile, title, account_type, passed_by, notes)
      values (
        (r ->> 'company_id')::uuid,
        r ->> 'name',
        r ->> 'mobile',
        r ->> 'title',
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
