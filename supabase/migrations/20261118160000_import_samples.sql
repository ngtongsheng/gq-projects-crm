-- Loop 18 task 08: "Paste from Excel" on the Samples page. Adds new samples and updates the ones
-- already listed, in one transaction. Runs as the signed-in person (security invoker), so the
-- editor rules on samples still apply. A changed quantity goes through the move log like any
-- other quantity change; the unit of a listed sample never changes. Nothing stored changes.
create function public.import_samples(import_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  sample_id uuid;
  at_best_link numeric;
begin
  for r in select value from jsonb_array_elements(import_rows) loop
    if r ? 'id' then
      sample_id := (r ->> 'id')::uuid;
      update public.samples s set
        product = case when r ? 'product' then r ->> 'product' else s.product end,
        brand = case when r ? 'brand' then r ->> 'brand' else s.brand end,
        sku = case when r ? 'sku' then r ->> 'sku' else s.sku end,
        name = case when r ? 'name' then r ->> 'name' else s.name end,
        spec = case when r ? 'spec' then r ->> 'spec' else s.spec end,
        notes = case when r ? 'notes' then r ->> 'notes' else s.notes end
      where s.id = sample_id
      returning s.qty into at_best_link;
      if not found then
        raise exception 'Sample % could not be updated.', sample_id;
      end if;

      if r ? 'qty' and (r ->> 'qty')::numeric is distinct from at_best_link then
        insert into public.sample_moves (sample_id, kind, qty)
        values (sample_id, 'adjust', (r ->> 'qty')::numeric);
      end if;
    else
      insert into public.samples (product, brand, sku, name, qty, unit, spec, notes)
      values (
        r ->> 'product',
        r ->> 'brand',
        r ->> 'sku',
        r ->> 'name',
        (r ->> 'qty')::numeric,
        r ->> 'unit',
        r ->> 'spec',
        r ->> 'notes'
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.import_samples(jsonb) from public, anon;
grant execute on function public.import_samples(jsonb) to authenticated;
