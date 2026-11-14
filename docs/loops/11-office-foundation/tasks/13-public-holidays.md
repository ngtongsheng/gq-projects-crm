---
model: sonnet
effort: high
why: Date maths used by pace, reports, leave and claims; holidays and the Mon-Sat site week must be right
depends: []
---
# 13 Public holidays + workdays
## Goal
Workday maths excludes public holidays and supports a Mon-Sat week for site supervisors. Clears the holiday row in
`docs/debt.md`.
## Context
- Demo: public holidays panel in Leave (~3217-3225) and its seed in `buildSeed()` (~1589-1794): copy the holiday list.
  "Working days Mon-Fri, Mon-Sat for site supervisors; public holidays not counted". D11.
- `src/lib/domain/workdays.ts` today: Mon-Fri only (debt row "No public-holiday calendar ...").
## Files to touch
- `supabase/migrations/<ts>_public_holidays.sql` (new): `public_holidays(day date primary key, name text)`, read for
  signed-in people, write md and accounts, seeded with the demo's list
- `src/lib/domain/workdays.ts` (+ test), its callers if their signature changes
- `docs/debt.md` (remove the row)
## Steps
1. Table and seed. 2. `workdays` takes the holiday list and a week kind (`mon-fri` | `mon-sat`). 3. Callers load
holidays once per request. 4. Tests around holidays, month ends and Saturdays.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass.
## Out of scope
The holiday editing screen (Leave, lane People & HR).
