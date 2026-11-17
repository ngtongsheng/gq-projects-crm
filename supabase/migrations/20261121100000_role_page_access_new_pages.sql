-- Loop 25 task 01: People's "What each role can see" gains Custom samples (tuft) and Marketing
-- expense (mkt). The defaults live in code (src/lib/auth/pages.ts); only the check on the
-- MD's override rows needs to know the two new page keys.
alter table public.role_page_access
  drop constraint role_page_access_page_key_check;

alter table public.role_page_access
  add constraint role_page_access_page_key_check check (page_key in (
    'today', 'tuft', 'hr', 'tools', 'claims', 'mkt', 'tasks', 'leave', 'dash', 'cal', 'inst',
    'cust', 'proj', 'cost', 'mof', 'site', 'stock', 'coll', 'comm', 'perf', 'rep', 'srep',
    'drep', 'margin'
  ));
