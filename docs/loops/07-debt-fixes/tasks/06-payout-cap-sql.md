---
model: opus
effort: medium
why: ports commission maths to SQL; must match TS exactly (money, rounding, tiers) and be proven by a parity test
depends: [01]
---
# 06 Payout cap in SQL + parity test (finding 20)
## Goal
The database refuses a commission payout above payable-now, computed by a SQL function that a test proves matches
TypeScript `calculateCommission` on the same cases (D3).
## Context
- Source: `docs/loops/05-audit-smoke/findings.md` (row noted in the title) and its row in `docs/debt.md`.
- Decisions D1-D8 in `docs/loops/07-debt-fixes/loop.md` bind this task. Read only your D rows.
- DB tests use the harness from task 01 (`supabase/tests/`), not a new pattern.
- TS: `src/lib/domain/commission.ts`, `commission-balance.ts`, `commission-settings.ts`. SQL: `commission_basis` in
  `supabase/migrations/20261103150000_commission_payouts.sql` (returns the margin tier, never the cost). Cost stays
  hidden from non-managers: the new function must not leak it.
- Cent rounding: loop 05 #03 aligned half-cent rounding; match it.
## Files to touch
- new migration `<ts>_cap_commission_payouts.sql` (payable-now function + before-insert trigger, MOF row lock)
- `supabase/tests/commission-parity.test.ts` (table of cases: tiers, pass-down, partial payments, VO, rounding edges)
- `src/app/(app)/commission/actions.ts` (map the DB refusal to the plain message)
- `docs/debt.md` (remove "Commission payout cap is checked only in the app")
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass; `pnpm guard:migrations` reports no risky changes.
- The new test fails on the code before the fix and passes after (state how you checked).
- The finding's row is removed from `docs/debt.md`.
- Parity test covers at least every tier boundary and a half-cent case.
## Out of scope
- Changing commission rules.
