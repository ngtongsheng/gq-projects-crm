---
model: opus
effort: medium
why: State machine plus permissions; server actions must enforce what the UI shows
depends: [01]
---
# 02 Task flow rules
## Goal
Domain module + server actions: Not Started → In Progress → Pending Review → Revision Required → Completed. Only
assigner or md approves; revision needs a comment and bumps revision count; every change writes a log entry. Who may
assign per D4. Overdue / due this week / escalation (`tkCfg` before 1, after 1, esc 2 days) computed, no cron (D3).
## Context
- Demo `vTasks` ~3104, `tkCfg` ~3083. Existing pattern: `src/lib/domain/*.ts` with colocated tests.
## Files to touch
- `src/lib/domain/task-flow.ts` (+ test), task server actions under the new `/tasks` route
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: every allowed and refused transition per role; revision
  without comment refused; overdue and escalation dates.
