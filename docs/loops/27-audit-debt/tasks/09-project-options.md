---
tier: standard
why: three loaders differ in the own-projects filter, which is a permission-shaped detail
depends: []
---
# 09 Shared project picker loader (B5)
## Goal
One `projects/project-options-data.ts` loads "projects not lost, labelled name · company" with an optional owner
filter, used by tasks, installation booking and stock. Each picker shows the same projects in the same order.
## Context
Read `00-shared-context.md`. Audit row B5: `tasks/task-data.ts:93-107`, `installation/booking-data.ts:111-129`,
`stock/stock-data.ts:145-163`. The own-projects filter differs: keep each caller's filter exactly (who sees which
projects is a permission rule).
## Files to touch
- new `src/app/(app)/projects/project-options-data.ts`
- `src/app/(app)/tasks/task-data.ts`, `src/app/(app)/installation/booking-data.ts`, `src/app/(app)/stock/stock-data.ts`
## Steps
1. Diff the three loaders (select, filters, order, label, error text).
2. Write the shared loader; replace the three.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass; existing tests for these features pass unchanged.
## Out of scope
Picker UI.
