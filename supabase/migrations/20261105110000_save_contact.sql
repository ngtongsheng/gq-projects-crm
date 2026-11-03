-- Adding or changing a customer in one transaction (loop 05 finding 31, loop 07 D5). The app
-- used to save a new company first and the customer second, so a failure on the second left
-- the company behind and the retry was refused with "company already exists". Security
-- invoker: every write still goes through the caller's grants, RLS and triggers, so the
-- account type guard, the owner limit and the "creator becomes owner" trigger all still run.
--
-- contact_id is null for a new customer. contact holds the contacts columns the form sets.
-- company is null to use contact.company_id, or holds name, company_type and rating of a
-- company to add first; its new id then replaces contact.company_id.
create function public.save_contact(
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
    insert into public.companies (name, company_type, rating)
    values (posted_company.name, posted_company.company_type, posted_company.rating)
    returning id into company_ref;
  end if;

  if cid is null then
    insert into public.contacts (company_id, name, mobile, title, rating, account_type,
      passed_by, notes)
    values (company_ref, posted.name, posted.mobile, posted.title, posted.rating,
      posted.account_type, posted.passed_by, posted.notes)
    returning id into cid;
  else
    update public.contacts c set
      company_id = company_ref,
      name = posted.name,
      mobile = posted.mobile,
      title = posted.title,
      rating = posted.rating,
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

revoke execute on function public.save_contact(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_contact(uuid, jsonb, jsonb) to authenticated;
