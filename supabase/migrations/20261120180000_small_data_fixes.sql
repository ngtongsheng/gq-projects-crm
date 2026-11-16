-- Audit round 2 (loop 24 task 08): the Malaysian day for two defaults, and receipt numbers that
-- cannot collide.

-- The default day was the UTC day, so a task assigned at 00:30 Malaysian time said "yesterday".
alter table public.tasks
  alter column assigned_on set default (now() at time zone 'Asia/Kuala_Lumpur')::date;

alter table public.fob_enquiries
  alter column enquiry_date set default (now() at time zone 'Asia/Kuala_Lumpur')::date;

-- Two receipts attached to one claim at the same moment both read the same max and collided on
-- the unique index. Locking the claim row first makes the second wait and read the new max.
-- Security definer: the lock needs update rights on the claim that the person's role lacks.
create or replace function public.prepare_monthly_claim_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.expense_type = 'mileage' and new.adjusted_by is null then
    new.amount := round(new.km * coalesce((
      select (value ->> 'mileageRatePerKm')::numeric from public.app_settings where key = 'claims'
    ), 0.6), 2);
  end if;
  if tg_op = 'INSERT' then
    new.original_amount := coalesce(new.original_amount, new.amount);
  end if;
  if (select auth.uid()) is not null and new.adjusted_by is null then
    new.original_amount := new.amount;
  end if;
  if new.receipt_path is null then
    new.receipt_no := null;
  elsif tg_op = 'INSERT' or old.receipt_no is null then
    perform 1 from public.monthly_claims where id = new.claim_id for update;
    new.receipt_no := coalesce((
      select max(receipt_no) from public.monthly_claim_expenses where claim_id = new.claim_id
    ), 0) + 1;
  end if;
  return new;
end;
$$;

revoke execute on function public.prepare_monthly_claim_expense() from public, anon, authenticated;
