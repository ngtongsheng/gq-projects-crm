---
model: opus
effort: medium
why: changes who can see what; RLS narrowing must not break MOF, collection, commission or dashboard views that join projects
depends: [01]
---
# 09 Projects own-only for salespeople (finding 55)
## Goal
bd and sales job roles read only projects where they are `pic_id`, `support_id` or `passed_by`; md, director,
accounts, site and support read all (D1). The app shows the same.
## Context
- Source: `docs/loops/05-audit-smoke/findings.md` (row noted in the title) and its row in `docs/debt.md`.
- Decisions D1-D8 in `docs/loops/07-debt-fixes/loop.md` bind this task. Read only your D rows.
- DB tests use the harness from task 01 (`supabase/tests/`), not a new pattern.
- Policy: `"projects: read all"` in `supabase/migrations/20261102180000_projects.sql`. Use `alter policy ... using (...)`
  and `comment on policy` (D1, D8); `has_job_role(...)` exists.
- Check every page and query that joins `projects` (MOFs, collection, commission, dashboards, reports, calendar,
  stock reservations, site bookings) still works for a salesperson: a hidden project must not crash a page or zero a
  manager figure. If the prototype spec (`docs/loops/03-crm-features/assets/prototype-spec.md`, Job roles) differs from
  D1, follow D1 and log the difference as a deviation.
## Files to touch
- new migration `<ts>_projects_own_only.sql`, `supabase/tests/projects-visibility.test.ts` (every job role)
- `src/app/(app)/projects/` page/filters if they assume all rows; any view found broken
- `docs/debt.md` (remove "Salespeople can read every project")
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass; `pnpm guard:migrations` reports no risky changes.
- The new test fails on the code before the fix and passes after (state how you checked).
- The finding's row is removed from `docs/debt.md`.
## Out of scope
- MOF visibility rules (unchanged unless a view breaks).
