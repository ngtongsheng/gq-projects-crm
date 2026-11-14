-- Loop 11 task 06: what each role can see, as the MD sets it in People ("What each role can
-- see"). The defaults live in code (src/lib/auth/pages.ts); a row here is the MD's override for
-- one role and one page, or for 'margin' ("See margin % and cost"). The MD is always allowed,
-- so there are no rows for 'md'. 'arrange' is a salesperson who also arranges stock.
create table public.role_page_access (
  role_key text not null check (role_key in (
    'sales', 'arrange', 'designer', 'marketing', 'ssup', 'site', 'support', 'accounts',
    'director', 'bd'
  )),
  page_key text not null check (page_key in (
    'today', 'hr', 'tools', 'claims', 'tasks', 'leave', 'dash', 'cal', 'inst', 'cust', 'proj',
    'cost', 'mof', 'site', 'stock', 'coll', 'comm', 'perf', 'rep', 'srep', 'drep', 'margin'
  )),
  allowed boolean not null,
  primary key (role_key, page_key)
);

alter table public.role_page_access enable row level security;

revoke all on table public.role_page_access from anon, authenticated;
grant select, insert, update, delete on table public.role_page_access to authenticated;

-- Everyone signed in reads it: the sidebar and page checks need their own role's row.
create policy "role page access: signed-in people read"
  on public.role_page_access for select
  to authenticated
  using (true);

create policy "role page access: md adds"
  on public.role_page_access for insert
  to authenticated
  with check ((select public.has_job_role('md')));

create policy "role page access: md edits"
  on public.role_page_access for update
  to authenticated
  using ((select public.has_job_role('md')))
  with check ((select public.has_job_role('md')));

create policy "role page access: md removes"
  on public.role_page_access for delete
  to authenticated
  using ((select public.has_job_role('md')));

create policy "left people: no access"
  on public.role_page_access
  as restrictive
  for all
  to authenticated
  using ((select public.is_active()))
  with check ((select public.is_active()));

-- Cost and margin: the MD always; otherwise the person's own "sees margin" tick, else the MD's
-- override for their role, else the default (HR & Accounts and Purchasing). Mirrors
-- canSeeMargin in src/lib/auth/pages.ts.
create or replace function public.can_see_mof_cost()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and (
        p.job_role = 'md'
        or p.sees_margin
        or coalesce(
          (
            select a.allowed from public.role_page_access a
            where a.page_key = 'margin'
              and a.role_key = case
                when p.job_role = 'sales' and p.arranges_stock then 'arrange'
                else p.job_role
              end
          ),
          p.job_role in ('accounts', 'support')
        )
      )
  );
$$;
