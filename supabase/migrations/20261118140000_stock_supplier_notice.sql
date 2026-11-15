-- Loop 18 task 06: which stock lines still need an email to the supplier (demo `notice`). The
-- database sets the notice when a hold is confirmed, extended or released, so no screen can
-- forget it. People only mark a notice as sent. No email is sent by the app (D6).

alter table public.stock_reservations
  add column supplier_notice text
    check (supplier_notice in ('reserve', 'extend', 'release')),
  add column supplier_notified_at timestamptz,
  add check (supplier_notified_at is null or supplier_notice is not null);

create function public.note_supplier_notice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Stock recorded straight as held (a salesperson's request starts as 'requested').
    if new.status in ('reserved', 'po_issued') then
      new.supplier_notice := 'reserve';
    end if;
    new.supplier_notified_at := null;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'reserved' and old.status = 'requested' then
      new.supplier_notice := 'reserve';
      new.supplier_notified_at := null;
    elsif new.status = 'released' and old.status in ('reserved', 'po_issued') then
      new.supplier_notice := 'release';
      new.supplier_notified_at := null;
    end if;
  elsif new.expires_on is distinct from old.expires_on
    and new.status in ('reserved', 'po_issued') then
    -- A reserve email not sent yet already carries the new date.
    if not (old.supplier_notice = 'reserve' and old.supplier_notified_at is null) then
      new.supplier_notice := 'extend';
      new.supplier_notified_at := null;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.note_supplier_notice() from public, anon, authenticated;

-- Named so it fires after guard_reservation_move (triggers run in name order).
create trigger on_reservation_notice
  before insert or update on public.stock_reservations
  for each row execute function public.note_supplier_notice();

-- The notice itself is set only by the trigger; people mark it as sent.
grant update (supplier_notified_at) on table public.stock_reservations to authenticated;
