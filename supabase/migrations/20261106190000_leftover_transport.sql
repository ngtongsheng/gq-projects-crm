-- Purchasing notes how a leftover is getting back, e.g. "Lalamove booked, Tuesday 10am", so
-- everyone can see transport is arranged. Only the people who arrange stock write it, as with
-- the rest of the update.
alter table public.leftovers
  add column transport text check (transport is null or (transport = btrim(transport) and transport <> ''));

grant update (transport) on table public.leftovers to authenticated;
