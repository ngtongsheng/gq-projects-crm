-- Payments, commission payouts and overtime cannot be dated after today in Malaysia. A check
-- constraint cannot use today's date, so the app alone checked it and a direct API call could
-- date one ahead. These dates are only set on insert (no update grant on them).
-- Arguments: the date column, then the message shown when it is in the future.

create function public.refuse_future_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) ->> tg_argv[0])::date > (now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception '%', tg_argv[1] using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.refuse_future_date() from public, anon, authenticated;

create trigger refuse_future_received_on
  before insert on public.payments
  for each row execute function public.refuse_future_date('received_on', 'That date is in the future.');

create trigger refuse_future_paid_on
  before insert on public.commission_payouts
  for each row execute function public.refuse_future_date('paid_on', 'That date is in the future.');

create trigger refuse_future_work_date
  before insert on public.ot_claims
  for each row execute function public.refuse_future_date(
    'work_date', 'You cannot claim overtime for a day that has not come.');
