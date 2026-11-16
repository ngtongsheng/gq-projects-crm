-- An order's total (contract_sum + vo_amount) cannot be lowered below the payments already
-- received. Covers update_mof_total, save_mof and a VO lowered or removed (sync_mof_vo_amount
-- updates vo_amount, which fires this too). Only lowering is checked, so an order already below
-- its payments from before this rule can still be raised. The UPDATE has locked the order row,
-- and cap_payments locks the same row before it adds a payment, so the two queue up.
-- Security definer because the people who change the total cannot read every payment.
-- Same errcode and money format as cap_payments, so the app shows the message as it is.

create function public.floor_order_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_total numeric := new.contract_sum + new.vo_amount;
  received numeric;
begin
  if new_total >= old.contract_sum + old.vo_amount then
    return new;
  end if;

  select coalesce(sum(p.amount), 0) into received
    from public.payments p
    where p.mof_id = new.id;

  if new_total < received then
    raise exception 'The order total can''t go below RM % already received.',
      to_char(received, 'FM999,999,999,990.00')
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.floor_order_total() from public, anon, authenticated;

create trigger keep_order_total_above_payments
  before update of contract_sum, vo_amount on public.mofs
  for each row execute function public.floor_order_total();
