-- Account type and passed-by decide the commission rate, and a project copies them from its
-- customer (guard_project_write). Only the MD or Sales Director sets them (loop 03 #05); the app
-- enforced this but the database did not, so an owner could change their own customer's rate
-- through the API. HR & Accounts only reads customers, even when made an owner.
-- Skipped when there is no signed-in user (the service role, e.g. example data scripts).

create function public.guard_customer_account_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.has_job_role('md', 'director')) then
    return new;
  end if;

  if tg_op = 'UPDATE' and (select public.has_job_role('accounts')) then
    raise exception 'HR & Accounts can view customers but not change them.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if tg_table_name = 'companies' then
      if new.account_type is not null or new.passed_by is not null then
        raise exception 'Only the MD or Sales Director can set the account type.'
          using errcode = '42501';
      end if;
    elsif new.account_type <> 'own' or new.passed_by is not null then
      raise exception 'Only the MD or Sales Director can set the account type.'
        using errcode = '42501';
    end if;
  elsif new.account_type is distinct from old.account_type
    or new.passed_by is distinct from old.passed_by then
    raise exception 'Only the MD or Sales Director can change the account type.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_customer_account_type() from public, anon, authenticated;

create trigger guard_company_account_type
  before insert on public.companies
  for each row execute function public.guard_customer_account_type();

create trigger guard_contact_account_type
  before insert or update on public.contacts
  for each row execute function public.guard_customer_account_type();
