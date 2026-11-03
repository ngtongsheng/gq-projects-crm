-- Payments on an order cannot add up to more than contract_sum + vo_amount. The app read the
-- payments and then wrote, so two saves at once, or a direct API call, could pass the total.
-- Locks the order row so concurrent payments on it queue up. Security definer because the
-- accounts team cannot lock (update) orders or read every payment through their own policies.
-- The message matches the app's, so the screen can show it as it is.

create function public.cap_payments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_total numeric;
  received numeric;
begin
  select contract_sum + vo_amount into order_total
    from public.mofs
    where id = new.mof_id
    for update;
  if order_total is null then
    return new;
  end if;

  select coalesce(sum(amount), 0) into received
    from public.payments
    where mof_id = new.mof_id;

  if received + new.amount > order_total then
    raise exception 'That takes payments past the order total of RM %. If the order total has changed, change it on the MOF first.',
      to_char(order_total, 'FM999,999,999,990.00')
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.cap_payments() from public, anon, authenticated;

create trigger limit_payments_to_order_total
  before insert on public.payments
  for each row execute function public.cap_payments();
