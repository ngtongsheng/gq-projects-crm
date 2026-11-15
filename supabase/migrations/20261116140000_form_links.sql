-- Loop 16 task 09: the Drive links on Tools & Forms (demo formLinks). Admins add and remove a link
-- to a form kept as a PDF in Google Drive; everyone signed in reads the list.

create table public.form_links (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  url text not null check (char_length(url) <= 500 and url ~ '^https://[^[:space:]]+$'),
  note text not null default '' check (char_length(note) <= 200),
  added_by uuid not null default auth.uid() references public.profiles (id),
  added_at timestamptz not null default now()
);

alter table public.form_links enable row level security;

revoke all on table public.form_links from anon, authenticated;
grant select, delete on table public.form_links to authenticated;
grant insert (name, url, note) on table public.form_links to authenticated;

create policy "form links: read all"
  on public.form_links for select to authenticated
  using (true);

create policy "form links: admins add"
  on public.form_links for insert to authenticated
  with check ((select public.is_admin()));

create policy "form links: admins remove"
  on public.form_links for delete to authenticated
  using ((select public.is_admin()));

-- Same rule as every table (loop 11): a person who has left reads and writes nothing.
create policy "left people: no access"
  on public.form_links as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
