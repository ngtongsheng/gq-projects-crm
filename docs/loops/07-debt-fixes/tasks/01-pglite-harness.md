---
model: opus
effort: medium
why: test infrastructure every later task builds on; Supabase auth schema and roles must be stubbed correctly
depends: []
---
# 01 PGlite harness + first test
## Goal
`pnpm test` runs SQL tests against a fresh in-memory Postgres with every migration in `supabase/migrations` applied,
and a test can act as any job role. Closes finding 3.
## Context
- Source: `docs/loops/05-audit-smoke/findings.md` (row noted in the title) and its row in `docs/debt.md`.
- Decisions D1-D8 in `docs/loops/07-debt-fixes/loop.md` bind this task. Read only your D rows.
- DB tests use the harness from task 01 (`supabase/tests/`), not a new pattern.
- Loop 05 #02/#09 verified triggers with a throwaway PGlite script that stubbed `auth.uid()` and roles; that approach
  worked. Check the installed pglite version and its README in node_modules before using its API.
- Migrations reference Supabase objects (`auth.users`, `auth.uid()`, roles `anon`/`authenticated`/`service_role`,
  maybe extensions). Stub only what the migrations need, in one bootstrap SQL file.
## Files to touch
- `package.json` (devDependency via `pnpm add -D @electric-sql/pglite`), `vitest.config.ts` if needed
- `supabase/tests/harness.ts` (new): fresh DB per test file, `actAs(jobRole | null)` helper, seeded profiles per job role
- `supabase/tests/bootstrap.sql` (new): auth/role stubs
- `supabase/tests/customers-guard.test.ts` (new): finding 1 (account type guard) per role
- `docs/debt.md` (remove the "No automated tests for database permission rules" row)
## Steps
1. Add the dependency; write bootstrap + harness; apply all migrations in filename order.
2. Test finding 1: sales cannot set account type or passed-by; md can; accounts cannot edit contacts.
3. Keep the suite fast (one DB per file); note the runtime in your report.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass; `pnpm guard:migrations` reports no risky changes.
- The new test fails on the code before the fix and passes after (state how you checked).
- The finding's row is removed from `docs/debt.md`.
## Out of scope
- Tests for other triggers (task 02).
