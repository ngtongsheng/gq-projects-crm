-- Loop 24 audit round 2 (S-DB1, S-DB2, S-DB3).
--
-- S-DB1: a file is added to <area>/<record-id>/ only by someone who may change that record. Before,
-- any active person could add a file under any record id; the server actions checked, the bucket
-- did not. Each area mirrors the rule of the table its file is recorded on:
--   claims/<claim id>        receipts: monthly claim expenses update (owner of an open claim, or a checker)
--   leave/<request id>       slips: leave requests update (the person, the MD, HR & Accounts)
--   tasks/<task id>          task files insert (the assigner, or someone on the task)
--   hr-policies/<doc id>     hr policy documents (MD, HR & Accounts); the row is saved after the upload
-- An area not listed here is refused: a new upload area adds its rule here.
create function public.can_attach(area text, record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active() and case area
    when 'claims' then
      public.owns_open_monthly_claim(record_id) or public.adjusts_monthly_claim(record_id)
    when 'leave' then exists (
      select 1 from public.leave_requests r
      where r.id = record_id
        and (r.person_id = (select auth.uid()) or public.has_job_role('md', 'accounts'))
    )
    when 'tasks' then
      public.assigned_task(record_id) or public.works_on_task(record_id)
    when 'hr-policies' then
      public.has_job_role('md', 'accounts')
    else false
  end;
$$;

revoke execute on function public.can_attach(text, uuid) from public, anon;
grant execute on function public.can_attach(text, uuid) to authenticated;

-- The case checks the path shape before the uuid cast (a plain AND has no fixed order), so a
-- malformed name is refused rather than raising. The policy keeps its name because the
-- migration guard refuses drop policy.
alter policy "attachments: people add their own"
  on storage.objects
  with check (
    bucket_id = 'attachments'
    and owner_id = (select auth.uid())::text
    and (select public.is_active())
    and case
      when name ~ '^[a-z][a-z0-9-]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-][a-z0-9._-]*$'
        then public.can_attach(split_part(name, '/', 1), split_part(name, '/', 2)::uuid)
      else false
    end
  );

-- S-DB2, S-DB3: same rule as every table, a person who has left reads and writes nothing.
create policy "left people: no access"
  on public.weekly_reports as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.activity_invitees as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
