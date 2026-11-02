-- The moves a stock reservation may make, mirroring MOVES in src/lib/domain/reservation.ts:
-- requested to reserved or cancelled; reserved to PO issued, delivered or released; PO issued
-- to delivered or released. Delivered, released and cancelled are final. The app checked this
-- alone, so a stock editor calling the API could reopen a cancelled or delivered line.

create function public.guard_reservation_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if not (
    (old.status = 'requested' and new.status in ('reserved', 'cancelled'))
    or (old.status = 'reserved' and new.status in ('po_issued', 'delivered', 'released'))
    or (old.status = 'po_issued' and new.status in ('delivered', 'released'))
  ) then
    raise exception 'A reservation cannot move from % to %.', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_reservation_move() from public, anon, authenticated;

create trigger guard_reservation_move
  before update on public.stock_reservations
  for each row execute function public.guard_reservation_move();
