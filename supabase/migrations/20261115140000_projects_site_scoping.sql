-- Loop 12 task 09: a Site Supervisor reads only the projects they are on (PIC, support or
-- passed_by), as the demo's tmP does for every role whose team is themself. A Site Supervisor
-- who also sells keeps their own sales projects through the same rule. Site Work and
-- Installation read MOFs and bookings, which carry their own project name, so they are not
-- affected. Everyone else reads what they read before.

-- Policies keep their old names because the migration guard refuses drop policy.
alter policy "projects: read all"
  on public.projects
  using (
    (select public.has_job_role('md', 'accounts', 'support', 'ssup'))
    or public.in_my_team(pic_id)
    or public.in_my_team(support_id)
    or public.in_my_team(passed_by)
  );

comment on policy "projects: read all" on public.projects is
  'Despite the name: MD, HR & Accounts, Purchasing and Sales support read all; Sales and Marketing Directors read their team''s; everyone else, Site included, reads projects where they are PIC, support or passed_by (loop 07 task 09, loop 11 tasks 03-04, loop 12 task 09).';
