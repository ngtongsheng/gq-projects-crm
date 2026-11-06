-- Asking for a whole company is allowed only while it is released. This replaces the insert
-- policy on ownership requests, which the migration check holds for the owner's approval.
drop policy "ownership requests: salespeople ask for customers they do not own"
  on public.ownership_requests;

create policy "ownership requests: salespeople ask for customers they do not own"
  on public.ownership_requests for insert
  to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'
    and (select public.has_job_role('bd', 'sales'))
    and not public.is_contact_owner(contact_id)
    and (
      not whole_company
      or public.company_is_released(
        (select c.company_id from public.contacts c where c.id = contact_id)
      )
    )
  );
