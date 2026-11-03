-- Mirrors NEXT in src/app/(app)/activities/activity-access.ts and the activity form: a planned
-- activity is completed or cancelled, both final, and a completed activity cannot start in the
-- future. The app checked this alone, so an owner calling the API could reopen a cancelled
-- visit or complete one dated next week, which feeds the visit count and customer health flag.

create function public.guard_activity_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status <> 'planned' and new.status <> old.status then
    raise exception 'A completed or cancelled activity can''t be reopened.'
      using errcode = 'check_violation';
  end if;
  if new.status = 'completed' and new.starts_at > now() then
    raise exception 'A completed activity can''t be in the future.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_activity_status() from public, anon, authenticated;

create trigger guard_activity_status
  before insert or update on public.activities
  for each row execute function public.guard_activity_status();
