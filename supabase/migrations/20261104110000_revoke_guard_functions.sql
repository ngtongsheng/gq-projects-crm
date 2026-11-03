-- Every other trigger function has execute revoked; these four were missed. Postgres refuses to
-- call a trigger function directly, so this only keeps the API surface the same as the rest.
revoke execute on function public.guard_installer_claim() from public, anon, authenticated;
revoke execute on function public.guard_job() from public, anon, authenticated;
revoke execute on function public.guard_delivery_order() from public, anon, authenticated;
revoke execute on function public.guard_site_booking() from public, anon, authenticated;
