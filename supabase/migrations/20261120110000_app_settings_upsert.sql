-- Saving a setting is an upsert (insert ... on conflict (key) do update). PostgREST writes every
-- column of an upsert in the update half too, including key, but only `value` could be updated, so
-- the MD got "not allowed" saving the claim, commission, stock and site reminder settings. The
-- policies still decide who may write which key; the check on the accounts policy pins key = 'claims'.

grant update (key) on table public.app_settings to authenticated;
