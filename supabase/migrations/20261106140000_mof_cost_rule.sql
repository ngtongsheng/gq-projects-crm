-- Who sees an MOF's cost: the MD, Purchasing and HR & Accounts. Until now it was every manager,
-- which included the Sales Director. The Sales Director no longer sees or sets cost.
-- Purchasing also reads payments, because the MOF summary shows received and balance next to
-- cost and margin. Nothing is deleted or changed in the stored data.
create function public.can_see_mof_cost()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_job_role('md', 'support', 'accounts');
$$;

revoke execute on function public.can_see_mof_cost() from public, anon;
grant execute on function public.can_see_mof_cost() to authenticated;

drop policy "mof costs: managers read" on public.mof_costs;
drop policy "mof costs: managers add" on public.mof_costs;
drop policy "mof costs: managers edit" on public.mof_costs;

create policy "mof costs: md, purchasing and accounts read"
  on public.mof_costs for select
  to authenticated
  using ((select public.can_see_mof_cost()));

create policy "mof costs: md, purchasing and accounts add"
  on public.mof_costs for insert
  to authenticated
  with check ((select public.can_see_mof_cost()));

create policy "mof costs: md, purchasing and accounts edit"
  on public.mof_costs for update
  to authenticated
  using ((select public.can_see_mof_cost()))
  with check ((select public.can_see_mof_cost()));

drop policy "payments: managers and the order's salespeople read" on public.payments;

create policy "payments: managers, purchasing and the order's salespeople read"
  on public.payments for select
  to authenticated
  using (
    (select public.is_manager())
    or (select public.has_job_role('support'))
    or exists (
      select 1 from public.mofs
      where mofs.id = payments.mof_id
        and (select auth.uid()) in (mofs.salesperson_id, mofs.second_salesperson_id)
    )
  );
