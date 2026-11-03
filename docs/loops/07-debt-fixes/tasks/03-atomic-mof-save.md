---
model: opus
effort: medium
why: moves a multi-table write (MOF, lines, total, cost) into one SQL function without loosening RLS or triggers
depends: [01]
---
# 03 Atomic MOF save (finding 14)
## Goal
Creating or editing an MOF is one transaction: a failure part-way saves nothing, and a retry works.
## Context
- Source: `docs/loops/05-audit-smoke/findings.md` (row noted in the title) and its row in `docs/debt.md`.
- Decisions D1-D8 in `docs/loops/07-debt-fixes/loop.md` bind this task. Read only your D rows.
- DB tests use the harness from task 01 (`supabase/tests/`), not a new pattern.
- Current save: `src/app/(app)/mofs/actions.ts` `saveMof` (several writes). `update_mof_total` requires a reason and
  role; the import path passes "Imported". Cost is manager-only (`mof_costs`).
## Files to touch
- new migration `supabase/migrations/<ts>_save_mof.sql` (`security invoker` function, D5)
- `src/app/(app)/mofs/actions.ts` (+ its test)
- `supabase/tests/save-mof.test.ts`
- `docs/debt.md` (remove "Saving an MOF is several separate writes")
## Steps
1. SQL function taking the validated MOF, lines, total reason and optional cost; returns the MOF id.
2. Action calls it via `rpc`; keep the plain messages the app shows today.
3. PGlite: a failing line insert leaves no MOF row; roles that may not set cost cannot via the function.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass; `pnpm guard:migrations` reports no risky changes.
- The new test fails on the code before the fix and passes after (state how you checked).
- The finding's row is removed from `docs/debt.md`.
## Out of scope
- Paste import (`mof-import.ts`) unless it shares the same save path.
