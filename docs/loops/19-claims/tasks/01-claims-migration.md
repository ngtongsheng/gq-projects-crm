---
model: opus
effort: medium
why: Money tables with RLS and a no-double-claim constraint
depends: []
---
# 01 Claims migration
## Goal
`monthly_claims` (person, month, status, original vs final amount, remark, receipts received, log), expense lines
(type, date, amount, km, receipt no, attachment, adjustment reason), commission lines (unique while pending, D2),
claim settings (cut-off, mileage 0.60/km, km/day 150, travel limit, needRep, late1/late2 + cut %). RLS: own; accounts
and md all; director reads team.
## Context
- `docs/office-parity/drift-money-reports.md` "Claims"; commission tables from loops 03/14; OT tables (`src/app/(app)/overtime/overtime-data.ts`).
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: RLS per role; double claim refused; one claim per person-month.
