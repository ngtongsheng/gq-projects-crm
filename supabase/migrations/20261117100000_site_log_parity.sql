-- Loop 17 task 01: the Log work wizard and the Site Work tabs (D2, D5).
-- Additive for stored rows: every existing site log and follow-up keeps its values. A visit
-- with several activities is saved as one log row per activity, as the demo does, so counts
-- by activity and the per-activity fields (measurement, photos) stay one row each.

-- A log for a new site has no MOF yet: it names the site and the salesperson instead, and
-- may point at the pipeline project.
alter table public.site_logs
  alter column mof_id drop not null;

-- Stock return joins the activities. "others" stays for logs saved before the wizard.
alter table public.site_logs
  drop constraint site_logs_activity_check,
  add constraint site_logs_activity_check
    check (activity in ('measurement', 'inspection', 'installation', 'handover', 'shooting',
      'touch_up', 'delivery', 'stock_return', 'others'));

alter table public.site_logs
  add column site_name text
    check (site_name is null or (site_name = btrim(site_name) and site_name <> '')),
  add column salesperson_id uuid references public.profiles (id),
  add column project_id uuid references public.projects (id) on delete set null,
  -- Installation: how much of the job is laid so far.
  add column inst_pct smallint check (inst_pct between 0 and 100),
  -- Measurement: the salesperson it goes to, the day it was sent, when they marked it received
  -- (measurement_received is the flag).
  add column measurement_to uuid references public.profiles (id),
  add column measurement_sent_on date,
  add column measurement_received_at timestamptz,
  -- Shooting photos, or the completed photos on a handover: who saves them to Drive, the day
  -- they were posted in the job WhatsApp group, and when they were saved (drive_link holds the
  -- folder).
  add column photos_to uuid references public.profiles (id),
  add column photos_posted_on date,
  add column photos_saved_at timestamptz,
  add column photos_saved_by uuid references public.profiles (id),
  -- Delivery: true when everything arrived fine, false when there was a problem.
  add column delivery_ok boolean,
  -- The answer to "any balance stock?", e.g. "No balance stock".
  add column return_answer text
    check (return_answer is null or (return_answer = btrim(return_answer) and return_answer <> '')),
  add constraint site_logs_mof_or_new_site check (
    (mof_id is not null and site_name is null and salesperson_id is null and project_id is null)
    or (mof_id is null and site_name is not null and salesperson_id is not null)
  ),
  add constraint site_logs_inst_pct_installation
    check (inst_pct is null or activity = 'installation'),
  add constraint site_logs_measurement_fields
    check (activity = 'measurement' or (measurement_to is null and measurement_sent_on is null)),
  add constraint site_logs_photos_fields
    check (activity in ('shooting', 'handover')
      or (photos_to is null and photos_posted_on is null and photos_saved_at is null)),
  add constraint site_logs_delivery_ok_delivery
    check (delivery_ok is null or activity = 'delivery'),
  add constraint site_logs_photos_saved_by
    check ((photos_saved_at is null) = (photos_saved_by is null));

create index site_logs_salesperson_id_idx on public.site_logs (salesperson_id);
create index site_logs_project_id_idx on public.site_logs (project_id);
create index site_logs_measurement_to_idx on public.site_logs (measurement_to);
create index site_logs_photos_to_idx on public.site_logs (photos_to);

-- Received and saved are stamped by the functions below, never sent with the log.
grant insert (site_name, salesperson_id, project_id, inst_pct, measurement_to,
  measurement_sent_on, photos_to, photos_posted_on, delivery_ok, return_answer)
  on table public.site_logs to authenticated;

-- A log is still never edited by hand. These three steps happen after it is saved, each by
-- the person the demo gives the button to.

-- The salesperson the measurement went to (or a manager) taps Received.
create function public.receive_measurement(site_log_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.site_logs l
  set measurement_received = true,
    measurement_received_at = coalesce(l.measurement_received_at, now())
  where l.id = receive_measurement.site_log_id
    and l.activity = 'measurement'
    and ((l.measurement_to = (select auth.uid()) and public.is_active()) or public.is_manager());

  if not found then
    raise exception 'Only the salesperson it was sent to, or a manager, can mark this measurement received.'
      using errcode = '42501';
  end if;
end;
$$;

-- The supervisor who logged the photos (or a manager) posts them in the WhatsApp group later.
create function public.mark_photos_posted(site_log_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.site_logs l
  set photos_posted_on = coalesce(l.photos_posted_on,
    (now() at time zone 'Asia/Kuala_Lumpur')::date)
  where l.id = mark_photos_posted.site_log_id
    and l.activity in ('shooting', 'handover')
    and ((l.supervisor_id = (select auth.uid()) and public.is_active()) or public.is_manager());

  if not found then
    raise exception 'Only the supervisor who logged these photos, or a manager, can mark them posted.'
      using errcode = '42501';
  end if;
end;
$$;

-- The person the photos went to, Purchasing, Sales support or a manager saves them to Drive.
create function public.save_photos_to_drive(site_log_id uuid, drive_link text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.site_logs l
  set drive_link = save_photos_to_drive.drive_link,
    photos_saved_at = coalesce(l.photos_saved_at, now()),
    photos_saved_by = coalesce(l.photos_saved_by, (select auth.uid()))
  where l.id = save_photos_to_drive.site_log_id
    and l.activity in ('shooting', 'handover')
    and l.photos_posted_on is not null
    and ((l.photos_to = (select auth.uid()) and public.is_active())
      or public.is_manager()
      or public.has_job_role('support', 'ssup'));

  if not found then
    raise exception 'These photos are not posted yet, or you cannot save them to Drive.'
      using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.receive_measurement(uuid) from public, anon;
revoke execute on function public.mark_photos_posted(uuid) from public, anon;
revoke execute on function public.save_photos_to_drive(uuid, text) from public, anon;
grant execute on function public.receive_measurement(uuid) to authenticated;
grant execute on function public.mark_photos_posted(uuid) to authenticated;
grant execute on function public.save_photos_to_drive(uuid, text) to authenticated;

-- Follow-ups: the person who chases it (the supervisor or the salesperson) besides the group.
alter table public.site_follow_ups
  add column assignee_id uuid references public.profiles (id);

create index site_follow_ups_assignee_id_idx on public.site_follow_ups (assignee_id);

grant insert (assignee_id) on table public.site_follow_ups to authenticated;

-- Marketing sees only the Photos and Site log tabs, so not follow-ups.
alter policy "site follow-ups: read all"
  on public.site_follow_ups
  using (not (select public.has_job_role('marketing')));

alter policy "site follow-ups: the owning group closes"
  on public.site_follow_ups
  using ((select public.can_close_follow_up(owner_group)) or assignee_id = (select auth.uid()))
  with check ((select public.can_close_follow_up(owner_group)) or assignee_id = (select auth.uid()));

-- "Still waiting": what happened, and the day to be reminded again. The latest row's date is
-- the follow-up's snooze.
create table public.site_follow_up_waits (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.site_follow_ups (id),
  note text not null check (note = btrim(note) and note <> ''),
  snoozed_until date not null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id)
);

create index site_follow_up_waits_follow_up_id_idx on public.site_follow_up_waits (follow_up_id);

-- Office or other days away from site. Leave and MC come from the Leave module (D2).
create table public.site_off (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id),
  kind text not null check (kind in ('office', 'other')),
  starts_on date not null,
  ends_on date not null,
  note text check (note is null or (note = btrim(note) and note <> '')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  check (ends_on >= starts_on)
);

create index site_off_profile_id_idx on public.site_off (profile_id);

-- A request for good photos or video of a job site worth showing.
create table public.shoot_requests (
  id uuid primary key default gen_random_uuid(),
  mof_id uuid not null references public.mofs (id),
  kind text not null default 'photos' check (kind in ('photos', 'video', 'photos_video')),
  due_on date not null,
  best_on date,
  -- Null: whoever is on site.
  supervisor_id uuid references public.profiles (id),
  note text check (note is null or (note = btrim(note) and note <> '')),
  status text not null default 'requested' check (status in ('requested', 'done', 'cancelled')),
  -- Stamped by the trigger below, never sent by the app.
  done_at timestamptz,
  done_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  check ((status = 'done') = (done_at is not null)),
  check ((done_at is null) = (done_by is null))
);

create index shoot_requests_mof_id_idx on public.shoot_requests (mof_id);
create index shoot_requests_supervisor_id_idx on public.shoot_requests (supervisor_id);

alter table public.site_follow_up_waits enable row level security;
alter table public.site_off enable row level security;
alter table public.shoot_requests enable row level security;

revoke all on table public.site_follow_up_waits from anon, authenticated;
revoke all on table public.site_off from anon, authenticated;
revoke all on table public.shoot_requests from anon, authenticated;

grant select on table public.site_follow_up_waits to authenticated;
grant insert (follow_up_id, note, snoozed_until) on table public.site_follow_up_waits to authenticated;

grant select, delete on table public.site_off to authenticated;
grant insert (profile_id, kind, starts_on, ends_on, note) on table public.site_off to authenticated;

grant select on table public.shoot_requests to authenticated;
grant insert (mof_id, kind, due_on, best_on, supervisor_id, note)
  on table public.shoot_requests to authenticated;
grant update (status) on table public.shoot_requests to authenticated;

create policy "left people: no access"
  on public.site_follow_up_waits as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.site_off as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "left people: no access"
  on public.shoot_requests as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy "site follow-up waits: read unless marketing"
  on public.site_follow_up_waits for select
  to authenticated
  using (not (select public.has_job_role('marketing')));

-- Whoever may close an open follow-up may say it is still waiting.
create policy "site follow-up waits: whoever chases it"
  on public.site_follow_up_waits for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.site_follow_ups f
      where f.id = follow_up_id
        and f.done_at is null
        and (public.can_close_follow_up(f.owner_group) or f.assignee_id = (select auth.uid()))
    )
  );

create policy "site off: read unless marketing"
  on public.site_off for select
  to authenticated
  using (not (select public.has_job_role('marketing')));

create policy "site off: a supervisor adds their own, a manager anyone's"
  on public.site_off for insert
  to authenticated
  with check (
    ((select public.has_job_role('site')) and profile_id = (select auth.uid()))
    or (select public.is_manager())
  );

create policy "site off: a supervisor removes their own, a manager anyone's"
  on public.site_off for delete
  to authenticated
  using (
    ((select public.has_job_role('site')) and profile_id = (select auth.uid()))
    or (select public.is_manager())
  );

create policy "shoot requests: read all"
  on public.shoot_requests for select
  to authenticated
  using (true);

create policy "shoot requests: sales, BD, marketing and managers ask"
  on public.shoot_requests for insert
  to authenticated
  with check (
    (select public.has_job_role('md', 'director', 'bd', 'sales', 'marketing'))
    and created_by = (select auth.uid())
    and status = 'requested'
  );

-- Permissive policies are ORed separately for USING and WITH CHECK, so each check repeats who
-- may do it: a requester cannot mark a request done, and the site team cannot cancel one.
create policy "shoot requests: the requester or a manager cancels"
  on public.shoot_requests for update
  to authenticated
  using (status = 'requested'
    and (created_by = (select auth.uid()) or (select public.is_manager())))
  with check (status = 'cancelled'
    and (created_by = (select auth.uid()) or (select public.is_manager())));

create policy "shoot requests: the site team marks done"
  on public.shoot_requests for update
  to authenticated
  using (status = 'requested' and (select public.has_job_role('md', 'director', 'site')))
  with check (status = 'done' and (select public.has_job_role('md', 'director', 'site')));

-- Done records who and when, from the server's clock and the signed-in user.
create function public.stamp_shoot_request_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    new.done_at = now();
    new.done_by = auth.uid();
  else
    new.done_at = null;
    new.done_by = null;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_shoot_request_done() from public, anon, authenticated;

create trigger stamp_shoot_request_done
  before update on public.shoot_requests
  for each row execute function public.stamp_shoot_request_done();
