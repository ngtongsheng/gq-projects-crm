---
model: sonnet
effort: high
why: one before-insert trigger with a sum check, plus tests
depends: [01]
---
# 05 Payment cap in the database (finding 49)
## Goal
The database refuses a payment that takes the MOF past `contract_sum + vo_amount`, with the app's message.
## Context
- Source: `docs/loops/05-audit-smoke/findings.md` (row noted in the title) and its row in `docs/debt.md`.
- Decisions D1-D8 in `docs/loops/07-debt-fixes/loop.md` bind this task. Read only your D rows.
- DB tests use the harness from task 01 (`supabase/tests/`), not a new pattern.
- App check: `src/app/(app)/collection/actions.ts` (loop 05 #10). Lock the MOF row (`for update`) so two inserts
  cannot both pass.
## Files to touch
- new migration `<ts>_cap_payments.sql`, `supabase/tests/payment-cap.test.ts`, `src/app/(app)/collection/actions.ts` (map the DB refusal to the plain message)
- `docs/debt.md` (remove "Payment total cap")
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass; `pnpm guard:migrations` reports no risky changes.
- The new test fails on the code before the fix and passes after (state how you checked).
- The finding's row is removed from `docs/debt.md`.
## Out of scope
- Refunds or negative payments.
