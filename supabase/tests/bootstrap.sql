-- The Supabase objects the migrations rely on, stubbed for PGlite. Only what the migrations
-- use: the API roles, auth.users, auth.uid() and Supabase's default grants on public.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants these by default, which is why the migrations revoke before granting.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Same source as Supabase: the signed-in user's id from the request's JWT claims.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase Storage's tables, as far as the storage migrations and policies use them. The real
-- ones have more columns; Storage fills owner_id from the signed-in user's id on upload.
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner_id text
);

alter table storage.objects enable row level security;

-- Supabase's default: the API roles hold every privilege and row-level security decides.
grant all on all tables in schema storage to anon, authenticated, service_role;
