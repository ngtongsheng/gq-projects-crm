---
model: opus
effort: medium
why: Dates and proration; easy to get subtly wrong
depends: [05]
---
# 06 Leave maths
## Goal
Pure functions: days in a request (working days per D5, half days, public holidays); default entitlement (prorated by
join month to half day in the join year, per demo `entDefault`); override wins; balance = al + carry − taken
(Approved) with Pending shown separately; MC balance. Years before 2027 return no balance (D2).
## Files to touch
- `src/lib/domain/leave-balance.ts` (+ test); reuse `src/lib/domain/workdays.ts`
## Acceptance
- `pnpm test` passes. Tests: join mid-year, half days, span over a public holiday and Sunday, site Saturday, override,
  carry, pending vs approved, 2026 has no balance.
