-- Loop 07 task 09 (finding 55): salespeople read only the projects they are on, as the
-- PIC, the supporting salesperson or the one who passed the customer down. The MD, Sales
-- Director, HR & Accounts, Site Supervisor and Purchasing still read every project.
-- The policy keeps its old name because the migration guard refuses drop policy.

alter policy "projects: read all"
  on public.projects
  using (
    (select public.has_job_role('md', 'director', 'accounts', 'site', 'support'))
    or (select auth.uid()) in (pic_id, support_id, passed_by)
  );

comment on policy "projects: read all" on public.projects is
  'Despite the name: managers, HR & Accounts, Site and Purchasing read all; BD and Sales read only projects where they are PIC, support or passed_by (loop 07 task 09).';
