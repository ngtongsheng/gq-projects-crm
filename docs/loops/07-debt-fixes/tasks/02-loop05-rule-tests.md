---
model: sonnet
effort: high
why: many role-by-role cases, but the harness and rules already exist
depends: [01]
---
# 02 Tests for loop 05 database rules
## Goal
Each loop 05 migration rule has PGlite tests for a refused and an allowed case.
## Context
- Source: `docs/loops/05-audit-smoke/findings.md` (row noted in the title) and its row in `docs/debt.md`.
- Decisions D1-D8 in `docs/loops/07-debt-fixes/loop.md` bind this task. Read only your D rows.
- DB tests use the harness from task 01 (`supabase/tests/`), not a new pattern.
- Migrations: `supabase/migrations/20261104110000_*` through `20261104170000_*` (guard revokes, installer claim cap,
  reservation moves, future dates, activity final states, keep one admin, monthly report submit checks).
- Concurrency (two sessions) is out of reach in PGlite; do not try.
## Files to touch
- `supabase/tests/*.test.ts` (one file per rule area)
## Steps
1. Per migration: one refused case (message matches the app message) and one allowed normal path.
2. Revokes: `authenticated` has no execute on trigger functions.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
- Changing any migration (a bug found here: fix it in a new migration and report it).
