-- Loop 15 task 01: Tasks (demo vTasks). A task has one main assignee, optional co-assignees,
-- a log of what happened and the files attached to it (reference files from the assigner,
-- work versions from the people doing it; the files themselves live in the attachments
-- bucket under tasks/<task-id>/, loop 15 D6).
--
-- Who reads (loop 15 D4, demo tkSee): the assigner, the main assignee and co-assignees; the
-- MD and Sales Director read every task. Nobody else.
-- Who writes: the job roles that assign work (md, director, bd, support, marketing) add tasks.
-- The assigner edits the details; the people on the task start it, submit it and move its due
-- date; the assigner or the MD, when not on the task, approves it or sends it back.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  -- The demo's eleven task types (TK_CAT).
  category text not null default 'design'
    check (category in (
      'customer_appointment', 'follow_up_customer', 'design', 'e_catalogue', 'sample_folder',
      'website_upload', 'new_product', 'product_launch', 'training_material',
      'marketing_material', 'other'
    )),
  project_id uuid references public.projects (id),
  -- The demo's "Or customer / project name" for work not tied to a project record.
  project_name text not null default '' check (char_length(project_name) <= 200),
  assignee_id uuid not null references public.profiles (id),
  assigned_by uuid not null default auth.uid() references public.profiles (id),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_on date not null default current_date,
  due_on date not null,
  status text not null default 'not_started'
    check (status in (
      'not_started', 'in_progress', 'pending_review', 'revision_required', 'completed'
    )),
  revision_count integer not null default 0 check (revision_count >= 0),
  submitted_at timestamptz,
  completed_at timestamptz,
  approved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assignee_id <> assigned_by),
  check (due_on >= assigned_on),
  check ((status = 'completed') = (completed_at is not null))
);

create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_assigned_by_idx on public.tasks (assigned_by);
create index tasks_project_id_idx on public.tasks (project_id);

-- "Working together with": they see, start, upload to and submit the task like the main
-- assignee.
create table public.task_co_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  primary key (task_id, profile_id)
);

create index task_co_assignees_profile_id_idx on public.task_co_assignees (profile_id);

-- Comments and history (demo tkLog). Written by the app on every change; never edited.
create table public.task_log_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  by_id uuid not null default auth.uid() references public.profiles (id),
  at timestamptz not null default now()
);

create index task_log_entries_task_id_idx on public.task_log_entries (task_id);

-- Reference files come with the task; work files are versioned: every file sent in one
-- submission shares a version number (demo tkSubmit).
create table public.task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- The attachments bucket path; same shape as src/lib/storage/attachment-rules.ts.
  path text not null unique
    check (char_length(path) <= 400 and starts_with(path, 'tasks/' || task_id::text || '/')),
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null
    check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  kind text not null check (kind in ('reference', 'work')),
  version integer check (version >= 1),
  uploaded_by uuid not null default auth.uid() references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  check ((kind = 'work') = (version is not null))
);

create index task_files_task_id_idx on public.task_files (task_id);

-- Helpers for the policies. Security definer so a policy on one table can look at the other
-- task tables without their own policies getting in the way (and without recursion).
create function public.works_on_task(task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    exists (
      select 1 from public.tasks where id = task and assignee_id = (select auth.uid())
    )
    or exists (
      select 1 from public.task_co_assignees
      where task_id = task and profile_id = (select auth.uid())
    )
  ) and public.is_active();
$$;

create function public.assigned_task(task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks where id = task and assigned_by = (select auth.uid())
  ) and public.is_active();
$$;

create function public.can_see_task(task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_job_role('md', 'director')
    or public.works_on_task(task)
    or public.assigned_task(task);
$$;

revoke execute on function public.works_on_task(uuid) from public, anon;
revoke execute on function public.assigned_task(uuid) from public, anon;
revoke execute on function public.can_see_task(uuid) from public, anon;
grant execute on function public.works_on_task(uuid) to authenticated;
grant execute on function public.assigned_task(uuid) to authenticated;
grant execute on function public.can_see_task(uuid) to authenticated;

-- The status flow and who edits what, which RLS cannot express per column (demo tkClick).
-- Status changes change nothing else; the stamps (submitted, completed, approver, revision
-- count) are set here, never by the app. Skipped when there is no signed-in user (the service
-- role, e.g. example data scripts).
create function public.guard_task_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  on_task boolean;
  stamps constant text[] := array[
    'status', 'revision_count', 'submitted_at', 'completed_at', 'approved_by', 'updated_at'
  ];
begin
  new.updated_at = now();
  if me is null then
    return new;
  end if;

  if old.status = 'completed' then
    raise exception 'A completed task cannot be changed.' using errcode = '42501';
  end if;

  on_task := old.assignee_id = me or exists (
    select 1 from public.task_co_assignees where task_id = old.id and profile_id = me
  );

  if new.status = old.status then
    if old.assigned_by = me then
      return new;
    end if;
    -- The people on the task may only move the due date (demo "Can't make the due date?").
    if on_task and (to_jsonb(new) - 'due_on' - 'updated_at') = (to_jsonb(old) - 'due_on' - 'updated_at') then
      return new;
    end if;
    raise exception 'Only the person who assigned the task edits it.' using errcode = '42501';
  end if;

  if (to_jsonb(new) - stamps) <> (to_jsonb(old) - stamps) then
    raise exception 'Changing a task''s status changes nothing else.' using errcode = '42501';
  end if;

  if on_task and old.status = 'not_started' and new.status = 'in_progress' then
    null;
  elsif on_task and old.status in ('not_started', 'in_progress', 'revision_required')
    and new.status = 'pending_review' then
    new.submitted_at = now();
  elsif not on_task and (old.assigned_by = me or (select public.has_job_role('md')))
    and old.status = 'pending_review' and new.status in ('completed', 'revision_required') then
    if new.status = 'completed' then
      new.completed_at = now();
      new.approved_by = me;
    else
      new.revision_count = old.revision_count + 1;
    end if;
  else
    raise exception 'A task cannot go from % to % here.', old.status, new.status
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_task_write() from public, anon, authenticated;

create trigger on_task_written
  before update on public.tasks
  for each row execute function public.guard_task_write();

alter table public.tasks enable row level security;
alter table public.task_co_assignees enable row level security;
alter table public.task_log_entries enable row level security;
alter table public.task_files enable row level security;

-- Column grants keep ids, the assigner, stamps and audit columns out of the app's hands.
-- Nothing is deleted except a co-assignee the assigner takes off.
revoke all on table public.tasks from anon, authenticated;
grant select on table public.tasks to authenticated;
grant insert (title, description, category, project_id, project_name, assignee_id, priority,
  assigned_on, due_on)
  on table public.tasks to authenticated;
grant update (title, description, category, project_id, project_name, assignee_id, priority,
  assigned_on, due_on, status)
  on table public.tasks to authenticated;

revoke all on table public.task_co_assignees from anon, authenticated;
grant select, delete on table public.task_co_assignees to authenticated;
grant insert (task_id, profile_id) on table public.task_co_assignees to authenticated;

revoke all on table public.task_log_entries from anon, authenticated;
grant select on table public.task_log_entries to authenticated;
grant insert (task_id, body) on table public.task_log_entries to authenticated;

revoke all on table public.task_files from anon, authenticated;
grant select on table public.task_files to authenticated;
grant insert (task_id, path, file_name, content_type, kind, version)
  on table public.task_files to authenticated;

-- Row columns first: a lookup by id would not see a row being inserted, so insert ... returning
-- would fail.
create policy "tasks: assigner, assignees, md and director read"
  on public.tasks for select
  to authenticated
  using (
    assigned_by = (select auth.uid())
    or assignee_id = (select auth.uid())
    or (select public.has_job_role('md', 'director'))
    or public.works_on_task(id)
  );

create policy "tasks: assigners add their own"
  on public.tasks for insert
  to authenticated
  with check (
    (select public.has_job_role('md', 'director', 'bd', 'support', 'marketing'))
    and assigned_by = (select auth.uid())
  );

create policy "tasks: assigner, assignees and md update"
  on public.tasks for update
  to authenticated
  using (
    assigned_by = (select auth.uid())
    or (select public.has_job_role('md'))
    or public.works_on_task(id)
  )
  with check (
    assigned_by = (select auth.uid())
    or (select public.has_job_role('md'))
    or public.works_on_task(id)
  );

create policy "task co-assignees: task readers read"
  on public.task_co_assignees for select
  to authenticated
  using (public.can_see_task(task_id));

create policy "task co-assignees: assigner adds"
  on public.task_co_assignees for insert
  to authenticated
  with check (public.assigned_task(task_id));

create policy "task co-assignees: assigner removes"
  on public.task_co_assignees for delete
  to authenticated
  using (public.assigned_task(task_id));

create policy "task log: task readers read"
  on public.task_log_entries for select
  to authenticated
  using (public.can_see_task(task_id));

create policy "task log: task readers write"
  on public.task_log_entries for insert
  to authenticated
  with check (public.can_see_task(task_id));

create policy "task files: task readers read"
  on public.task_files for select
  to authenticated
  using (public.can_see_task(task_id));

create policy "task files: assigner adds reference, assignees add work"
  on public.task_files for insert
  to authenticated
  with check (
    (kind = 'reference' and public.assigned_task(task_id))
    or (kind = 'work' and public.works_on_task(task_id))
  );

create policy "left people: no access"
  on public.tasks as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.task_co_assignees as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.task_log_entries as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.task_files as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
