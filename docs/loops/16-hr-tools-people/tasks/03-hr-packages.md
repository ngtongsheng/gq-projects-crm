---
model: sonnet
effort: high
why: Normal UI work; dated history needs care but no tricky logic
depends: [01]
---
# 03 HR: Staff packages + outstation
## Goal
Staff packages view: per-person current package and dated history (D4), add change sheet, standard packages for
sales and site, outstation rules (meal and hotel by level; manager = grade M1/M2, directors automatic, per demo
`hotelLvl`). Pure function for "package on date" with tests.
## Files to touch
- `src/lib/domain/staff-package.ts` (+ test), HR staff view components
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: package on a date between changes; hotel level rules.
  Parity check for md and accounts.
