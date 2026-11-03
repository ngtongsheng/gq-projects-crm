-- Progress and final claims together cannot pass the installer PO amount; deductions do not
-- count. The app checked this by reading the claims and then writing, so two saves at once, or
-- a direct API call, could pass it. Locks the PO row so concurrent claims on it queue up.
-- Fires after guard_installer_claim (trigger names run in order), which has already refused
-- anyone who may not change claim details.

create function public.cap_installer_claims()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  po_amount numeric;
  claimed numeric;
begin
  if new.claim_type = 'deduction' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.claim_type is not distinct from old.claim_type
    and new.amount is not distinct from old.amount then
    return new;
  end if;

  select amount into po_amount
    from public.installer_pos
    where id = new.installer_po_id
    for update;
  select coalesce(sum(amount), 0) into claimed
    from public.installer_claims
    where installer_po_id = new.installer_po_id
      and id is distinct from new.id
      and claim_type <> 'deduction';

  if claimed + new.amount > po_amount then
    raise exception 'These claims add up to more than the installer PO. If there is extra work, increase the PO amount first.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.cap_installer_claims() from public, anon, authenticated;

create trigger limit_installer_claims_to_po
  before insert or update on public.installer_claims
  for each row execute function public.cap_installer_claims();
