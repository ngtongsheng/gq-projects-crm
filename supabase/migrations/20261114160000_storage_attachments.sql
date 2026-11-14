-- File uploads: one private bucket for every module's attachments (leave MC slips, claim receipts,
-- task files, HR policy PDFs). Files live at <area>/<record-id>/<file>, e.g.
-- leave/3f2a.../1c9e...-mc-slip.jpg. Later modules add a folder name, not a bucket.
--
-- Access: a signed-in active person can add a file as themselves. Nobody can list, read, replace
-- or delete through the API; the app reads through short-lived signed links it creates on the
-- server after checking the person may see the record. Buckets are created here, not by hand
-- in the dashboard, so they move with the migrations to a new Supabase project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  1572864, -- 1.5 MB; the app downscales images before upload
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "attachments: people add their own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and owner_id = (select auth.uid())::text
    and name ~ '^[a-z][a-z0-9-]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-][a-z0-9._-]*$'
    and (select public.is_active())
  );

-- Same rule as every table: a person who has left reads and writes nothing, in every bucket.
create policy "left people: no access"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using ((select public.is_active()))
  with check ((select public.is_active()));
