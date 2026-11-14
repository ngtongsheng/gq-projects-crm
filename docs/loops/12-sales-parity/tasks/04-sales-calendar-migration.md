---
model: opus
effort: medium
why: Schema + RLS for three roles' visibility, backfill rule D3; mistakes leak data across teams
depends: []
---
# 04 Migration: outcomes, invitees, weekly reports, deadline
## Goal
The database holds everything tasks 05-08 need, with RLS for every job role.
## Context
- Drift doc "Sales Calendar" section lists new data: activity invitees, outcome fields (result, learnings, lead,
  late_logged, logged_at), weekly_reports (who, week, note, status, reviewed_by, reviewed_note, late), deadline.
- Demo data shapes: `inv:` ~3167, ~4918; outcome ~4841-4873; weekly reports ~4560-4570, ~4860-4872.
- `activities` today has a free-text `outcome` column: keep its values (map to learnings or keep both; no data loss).
- Team helpers from loop 11: `in_my_team`, `has_job_role` (see `20261114130000_team_scoping_sales.sql`).
- D3: set `logged_at` on existing completed activities. D6: `app_settings` deadline row, default Friday.
- D5: name the file with the current timestamp; `pnpm guard:migrations` must pass.
## Files to touch
- `supabase/migrations/<ts>_sales_calendar.sql` (new)
- `supabase/tests/sales-calendar.test.ts` (new): RLS per role
- generated DB types if the repo has them
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. RLS tests: invitee reads the
  activity; salesperson writes only own weekly report; md and own team lead can mark reviewed; other directors cannot.
## Out of scope
UI.
