---
model: sonnet
effort: high
why: a two-table write into one invoker SQL function, following task 03
depends: [01]
---
# 04 Atomic customer + new company save (finding 31)
## Goal
Adding a customer with a new company saves both or neither.
## Context
- Source: `docs/loops/05-audit-smoke/findings.md` (row noted in the title) and its row in `docs/debt.md`.
- Decisions D1-D8 in `docs/loops/07-debt-fixes/loop.md` bind this task. Read only your D rows.
- DB tests use the harness from task 01 (`supabase/tests/`), not a new pattern.
- Current save: `src/app/(app)/customers/actions.ts` (company first, then contact). The contact owner limit
  (`limit_contact_owners`) and the account type guard (loop 05) must still apply.
## Files to touch
- new migration `<ts>_save_contact.sql`, `src/app/(app)/customers/actions.ts` (+ test), `supabase/tests/save-contact.test.ts`
- `docs/debt.md` (remove "Adding a customer with a new company is two separate writes")
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass; `pnpm guard:migrations` reports no risky changes.
- The new test fails on the code before the fix and passes after (state how you checked).
- The finding's row is removed from `docs/debt.md`.
## Out of scope
- Editing existing companies.
