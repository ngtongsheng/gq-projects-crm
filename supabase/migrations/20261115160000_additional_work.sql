-- Variation orders from the MOF page, and additional work on a completed job (loop 14 task 03,
-- demo sheetVO / addWork). save_variation_order adds or changes a VO and its cost in one
-- transaction. A new VO that needs delivery or installation on a job the site marked completed
-- reopens it: site stage back to "Installation in progress", a completed or closed order back to
-- "Delivered – installing", and an alert for each site supervisor told, which stays until they
-- click "OK, noted" (D7: in the app only; WhatsApp comes with the Integration loop).
--
-- The site progress is the site stage's percentage, so the demo's "set back to 95%" becomes the
-- installation stage.

create table public.additional_work_alerts (
  id uuid primary key default gen_random_uuid(),
  variation_order_id uuid not null
    references public.mof_variation_orders (id) on delete cascade,
  supervisor_id uuid not null references public.profiles (id),
  noted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  unique (variation_order_id, supervisor_id)
);

create index additional_work_alerts_supervisor_id_idx
  on public.additional_work_alerts (supervisor_id);

alter table public.additional_work_alerts enable row level security;

-- Alerts are added only by reopen_for_additional_work; "OK, noted" is the only change.
revoke all on table public.additional_work_alerts from anon, authenticated;
grant select on table public.additional_work_alerts to authenticated;
grant update (noted_at) on table public.additional_work_alerts to authenticated;

-- The office sees who has noted; a supervisor sees their own.
create policy "additional work alerts: read all"
  on public.additional_work_alerts for select
  to authenticated
  using (true);

create policy "additional work alerts: the supervisor notes their own"
  on public.additional_work_alerts for update
  to authenticated
  using (supervisor_id = (select auth.uid()))
  with check (supervisor_id = (select auth.uid()) and noted_at is not null);

create policy "left people: no access"
  on public.additional_work_alerts
  as restrictive
  for all
  to authenticated
  using ((select public.is_active()))
  with check ((select public.is_active()));

-- Reopens the VO's job when the VO needs work and the site marked the job completed; tells the
-- site supervisors named in notify. Returns whether the job was reopened. Security definer
-- because the register editors cannot change the site stage themselves.
create function public.reopen_for_additional_work(
  variation_order_id uuid,
  notify uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  vo public.mof_variation_orders;
  current_mof public.mofs;
begin
  if not (select public.has_job_role('md', 'support', 'accounts')) then
    raise exception 'Only the MD, Purchasing or HR & Accounts can reopen a job for additional work.'
      using errcode = '42501';
  end if;

  select * into vo
  from public.mof_variation_orders v
  where v.id = reopen_for_additional_work.variation_order_id;
  if not found then
    raise exception 'Variation order not found.' using errcode = 'P0002';
  end if;
  if not vo.needs_work then
    return false;
  end if;

  select * into current_mof from public.mofs m where m.id = vo.mof_id for update;
  if current_mof.site_stage <> 'completed' then
    return false;
  end if;

  update public.mofs m
  set site_stage = 'installation',
    stage = case
      when m.stage in ('completed_payment_pending', 'closed') then 'delivered_installing'
      else m.stage
    end
  where m.id = current_mof.id;

  insert into public.additional_work_alerts (variation_order_id, supervisor_id)
  select vo.id, p.id
  from public.profiles p
  where p.id = any (reopen_for_additional_work.notify)
    and p.job_role = 'site'
  on conflict do nothing;

  return true;
end;
$$;

revoke execute on function public.reopen_for_additional_work(uuid, uuid[])
  from public, anon;
grant execute on function public.reopen_for_additional_work(uuid, uuid[]) to authenticated;

-- Adds a VO (variation_order_id null) or changes one, and sets its cost when cost is not null.
-- Only a new VO reopens a job: changing an old VO's details must not reopen a job finished
-- since. Security invoker, so the VO and cost policies decide who may write. Returns whether
-- the job was reopened.
create function public.save_variation_order(
  variation_order_id uuid,
  mof_id uuid,
  vo jsonb,
  cost numeric,
  notify uuid[]
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  posted public.mof_variation_orders;
  vid uuid := save_variation_order.variation_order_id;
  reopened boolean := false;
begin
  posted := jsonb_populate_record(null::public.mof_variation_orders, save_variation_order.vo);

  if vid is null then
    insert into public.mof_variation_orders (mof_id, vo_no, client_ref, confirmed_on, amount,
      description, qty, needs_work)
    values (save_variation_order.mof_id, posted.vo_no, posted.client_ref,
      posted.confirmed_on, posted.amount, posted.description, posted.qty,
      coalesce(posted.needs_work, false))
    returning id into vid;

    reopened := public.reopen_for_additional_work(vid, save_variation_order.notify);
  else
    update public.mof_variation_orders v set
      vo_no = posted.vo_no,
      client_ref = posted.client_ref,
      confirmed_on = posted.confirmed_on,
      amount = posted.amount,
      description = posted.description,
      qty = posted.qty,
      needs_work = coalesce(posted.needs_work, false)
    where v.id = vid and v.mof_id = save_variation_order.mof_id;
    if not found then
      raise exception 'Variation order not found.' using errcode = 'P0002';
    end if;
  end if;

  if save_variation_order.cost is not null then
    update public.mof_variation_order_costs c
    set cost = save_variation_order.cost
    where c.variation_order_id = vid;
    if not found then
      insert into public.mof_variation_order_costs (variation_order_id, cost)
      values (vid, save_variation_order.cost);
    end if;
  end if;

  return reopened;
end;
$$;

revoke execute on function public.save_variation_order(uuid, uuid, jsonb, numeric, uuid[])
  from public, anon;
grant execute on function public.save_variation_order(uuid, uuid, jsonb, numeric, uuid[])
  to authenticated;
