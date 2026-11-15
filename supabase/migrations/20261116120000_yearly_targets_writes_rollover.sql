-- Loop 16 task 06: finishes the per-year targets (D3).
-- 1. profiles.yearly_target is now a copy kept by the sync triggers, so nobody signed in edits it;
--    People writes yearly_targets instead.
-- 2. On 1 January nothing fires a trigger, so the copy would keep last year's target until the
--    next change. refresh_yearly_targets() brings every copy up to date; the app calls it where
--    the copy is read (Performance, the sales dashboard, People).

revoke update (yearly_target) on table public.profiles from authenticated;

create function public.refresh_yearly_targets()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
  set yearly_target = e.target
  from (
    select id, public.effective_sales_target(id, public.current_target_year()) as target
    from public.profiles
  ) e
  where p.id = e.id
    and p.yearly_target is distinct from e.target;
$$;

revoke execute on function public.refresh_yearly_targets() from public, anon;
grant execute on function public.refresh_yearly_targets() to authenticated;
