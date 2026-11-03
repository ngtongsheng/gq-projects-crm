---
model: sonnet
effort: medium
why: small derived value + one table cell, with a unit test
depends: []
---
# 08 Stock over-held display (finding 64)
## Goal
When on hand is below held, the Stock items table (and its CSV) shows "over-held by N" instead of only 0 available (D4).
## Context
- `src/app/(app)/stock/stock-items-table.tsx`, `src/lib/domain/reservation.ts`, `src/lib/format/quantity.ts` (`formatQuantity`).
- Theme tokens only; follow `docs/design-system.md` for the warning style.
## Files to touch
- `src/lib/domain/reservation.ts` (+ test), `src/app/(app)/stock/stock-items-table.tsx`, CSV export for stock if separate
- `docs/debt.md` (remove "Stock on hand can be set below what is held")
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass; test covers on hand < held, = held, > held.
## Out of scope
- Blocking the edit.
