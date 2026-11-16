-- Loop 18 task 05: the DO items editor saves all of a DO's lines in one step. Deleting the old
-- lines and adding the new ones as separate calls could lose the items if the second call
-- failed; here both happen in one transaction. Runs as the caller, so the schedulers' policies
-- on the lines and the DO still decide who may save.

create function public.replace_delivery_order_lines(
  p_job_id uuid,
  p_lines jsonb,
  p_items text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  order_id uuid;
begin
  select id into order_id from public.delivery_orders where job_id = p_job_id;
  if order_id is null then
    raise exception 'This delivery has no DO yet.' using errcode = '23514';
  end if;

  delete from public.delivery_order_lines where delivery_order_id = order_id;

  insert into public.delivery_order_lines
    (delivery_order_id, position, product, code, description, batch, unit, qty, covers)
  select
    order_id,
    line.position,
    line.value ->> 'product',
    line.value ->> 'code',
    line.value ->> 'description',
    line.value ->> 'batch',
    line.value ->> 'unit',
    (line.value ->> 'qty')::numeric,
    line.value ->> 'covers'
  from jsonb_array_elements(p_lines) with ordinality as line (value, position);

  -- The summary stays as it was when the DO is saved with no items.
  update public.delivery_orders
    set items = coalesce(p_items, items)
    where id = order_id;
end;
$$;

revoke execute on function public.replace_delivery_order_lines(uuid, jsonb, text) from public, anon;
grant execute on function public.replace_delivery_order_lines(uuid, jsonb, text) to authenticated;
