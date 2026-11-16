-- The next-number functions updated their one-row settings table with no WHERE clause. Supabase
-- runs the database with pg-safeupdate, which refuses such an update ("UPDATE requires a WHERE
-- clause"), so on the real database Purchasing could not issue a DO no., nobody could set the
-- next DO or pickup form no., and a pickup form could not be saved. The tests run on PGlite, which
-- has no pg-safeupdate, so they never saw it. Same bodies as before, with `where id` (the tables
-- hold one row, id is always true).

create or replace function public.issue_do_number(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  job record;
  current_no text;
  floor_no integer;
  issued integer;
begin
  if not (select public.has_job_role('md', 'director', 'support')) then
    raise exception 'Only the MD, Sales Director or Purchasing can issue a DO no.'
      using errcode = '42501';
  end if;

  -- Held until the transaction ends: a second caller waits here and then sees this number used.
  select next_no into floor_no from public.delivery_order_numbering for update;

  select id, mof_id, job_type into job from public.jobs where id = p_job_id;
  if job.id is null or job.job_type <> 'delivery' then
    raise exception 'A DO no. is issued for a delivery job.' using errcode = '23514';
  end if;

  select running_no into current_no from public.delivery_orders where job_id = p_job_id;
  if current_no is not null then
    return current_no;
  end if;

  issued := greatest(floor_no, public.last_delivery_order_number() + 1);

  insert into public.delivery_orders (mof_id, job_id, running_no, issued_at, issued_by)
  values (job.mof_id, p_job_id, lpad(issued::text, 4, '0'), now(), auth.uid())
  on conflict (job_id) do update
    set running_no = excluded.running_no,
      issued_at = excluded.issued_at,
      issued_by = excluded.issued_by;

  update public.delivery_order_numbering set next_no = issued + 1
    where id;

  return lpad(issued::text, 4, '0');
end;
$$;

create or replace function public.set_next_do_number(p_next_no integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_no integer;
begin
  if not (select public.has_job_role('md', 'support', 'accounts')) then
    raise exception 'Only the MD, Purchasing or HR & Accounts can set the next DO no.'
      using errcode = '42501';
  end if;

  perform 1 from public.delivery_order_numbering for update;

  last_no := public.last_delivery_order_number();
  if p_next_no is null or p_next_no <= last_no then
    raise exception 'The next DO no. must be higher than the last number used (%).', last_no
      using errcode = '23514';
  end if;
  if p_next_no > 9999 then
    raise exception 'The next DO no. has 4 digits.' using errcode = '23514';
  end if;

  update public.delivery_order_numbering set next_no = p_next_no
    where id;
end;
$$;

create or replace function public.set_next_sample_pickup_number(p_next_no integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_no integer;
begin
  if not (select public.can_edit_samples()) then
    raise exception 'Only the people who look after samples can set the next form no.'
      using errcode = '42501';
  end if;

  perform 1 from public.sample_pickup_settings for update;

  last_no := public.last_sample_pickup_number();
  if p_next_no is null or p_next_no <= last_no then
    raise exception 'The next form no. must be higher than the last number used (%).', last_no
      using errcode = '23514';
  end if;

  update public.sample_pickup_settings set next_no = p_next_no
    where id;
end;
$$;

create or replace function public.save_sample_pickup(p_pickup jsonb, p_lines jsonb)
returns table (pickup_id uuid, running_no integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  floor_no integer;
  issued integer;
  new_id uuid;
  line record;
  sample_unit text;
begin
  if not (select public.can_edit_samples()) then
    raise exception 'Only the people who look after samples can save a pickup form.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one item.' using errcode = '23514';
  end if;

  -- Held until the transaction ends: a second caller waits here and then sees this number used.
  select next_no into floor_no from public.sample_pickup_settings for update;
  issued := greatest(floor_no, public.last_sample_pickup_number() + 1);

  insert into public.sample_pickups (running_no, person_in_charge, contact, method,
    appointment_on, driver_contact, vehicle_no, address, taken_by, for_whom)
  values (
    issued,
    p_pickup ->> 'person_in_charge',
    p_pickup ->> 'contact',
    p_pickup ->> 'method',
    (p_pickup ->> 'appointment_on')::date,
    p_pickup ->> 'driver_contact',
    p_pickup ->> 'vehicle_no',
    p_pickup ->> 'address',
    (p_pickup ->> 'taken_by')::uuid,
    p_pickup ->> 'for_whom'
  )
  returning id into new_id;

  for line in
    select
      item.position::integer as position,
      (item.value ->> 'sample_id')::uuid as sample_id,
      item.value ->> 'product_name' as product_name,
      item.value ->> 'spec' as spec,
      (item.value ->> 'qty')::numeric as qty,
      item.value ->> 'unit' as unit,
      item.value ->> 'remarks' as remarks
    from jsonb_array_elements(p_lines) with ordinality as item (value, position)
  loop
    if line.sample_id is not null then
      select unit into sample_unit from public.samples where id = line.sample_id;
      if sample_unit is distinct from line.unit then
        raise exception 'Row %: this sample is counted in %.', line.position,
          coalesce(sample_unit, 'another unit')
          using errcode = '23514';
      end if;
    end if;

    insert into public.sample_pickup_lines
      (pickup_id, position, sample_id, product_name, spec, qty, unit, remarks)
    values (new_id, line.position, line.sample_id, line.product_name, line.spec, line.qty,
      line.unit, line.remarks);

    if line.sample_id is not null then
      insert into public.sample_moves (sample_id, kind, qty, taken_by, for_whom, pickup_id)
      values (line.sample_id, 'out', line.qty, (p_pickup ->> 'taken_by')::uuid,
        p_pickup ->> 'for_whom', new_id);
    end if;
  end loop;

  update public.sample_pickup_settings set next_no = issued + 1
    where id;

  return query select new_id, issued;
end;
$$;
