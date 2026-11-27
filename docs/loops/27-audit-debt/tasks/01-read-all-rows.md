---
tier: standard
why: three loaders with different shapes onto one helper; a missed page silently shortens money totals
depends: []
---
# 01 Event costs and paging loops onto readAllRows
## Goal
`loadEventCosts` returns every event cost row past 1000 (this is the top priority, needed before the marketing
history import). `allIds` and the installer job loader use `readAllRows` instead of their own loops. A failed
import clean-up is logged (B9).
## Context
Read `00-shared-context.md`. Debt section "Marketing and installer lists still read past the 1000-row cap" and
audit row B9. D5: no year filter on event costs (the table has no date; the dashboard shows every event).
`marketing_event_costs` has an `id` primary key, so it can be ordered by `id` when `stable`.
## Files to touch
- `src/app/(app)/marketing/marketing-data.ts` (`loadEventCosts`)
- `src/app/(app)/marketing/marketing-excel-store.ts` (`allIds`, the rollback `.catch(() => undefined)` around line 245)
- `src/app/(app)/installation/installer-data.ts` (`loadInstallerJobDates`, its `PAGE_SIZE`)
## Steps
1. `loadEventCosts`: wrap the query in `readAllRows` the way `loadMarketingExpenses` does. Keep the same error
   message and mapping.
2. `allIds`: use `readAllRows`, parse with `idRows`, keep the `must`-style error behaviour (throw on error). Remove
   the local `PAGE` constant if nothing else uses it.
3. `loadInstallerJobDates`: use `readAllRows` with the same filter and error text. Remove the local `PAGE_SIZE`.
4. B9: replace the swallowing catch with one that calls `logServerError` (message naming the failed clean-up, the
   table) and still lets the import report its original failure to the user unchanged.
## Acceptance
- `grep -rn "range(from" src/app` shows no hand-written paging loops left outside `readAllRows` callers.
- `pnpm test src/lib/supabase/read-all-rows.test.ts` passes. If a loader test exists for these files, it passes.
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
## Out of scope
A2 (moving year filters to the server), A6 (what the rollback covers).
