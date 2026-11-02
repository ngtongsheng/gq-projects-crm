---
model: sonnet
effort: high
why: money and date logic with tests
depends: []
---
# 03 Money, date and area helpers
## Goal
One place formats and calculates RM amounts, Malaysia dates, m2/sqft and workdays, all tested.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `10.764`, `workday`, `toLocaleString`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/lib/format/money.ts (+ test)
- src/lib/format/date.ts (+ test)
- src/lib/domain/area.ts (+ test)
- src/lib/domain/workdays.ts (+ test)
## Steps
1. `money.ts`: `formatRm(n)` ("RM 12,345.00"), `parseRm(text)` for form input (accepts commas), sums with 2-decimal rounding done on cents to avoid float drift.
2. `date.ts`: Malaysia-time `todayMyt()`, `formatDate`, `formatDateTime`, `daysBetween(a, b)` on calendar dates, `addDays`.
3. `area.ts`: `sqftToM2`, `m2ToSqft` (10.764), rounding to 2 decimals.
4. `workdays.ts`: Monday-Friday workdays in a month, elapsed workdays to a date, `pace(date)`; `firstMondayOfNextMonth(date)`. No public-holiday calendar (note in debt.md).
## Acceptance
- Tests cover rounding, month boundaries, leap year, first Monday when the 1st is a Monday.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Public holidays.
