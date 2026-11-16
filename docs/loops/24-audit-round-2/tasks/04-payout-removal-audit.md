---
tier: standard
why: one migration with trigger, RLS and a PGlite test; payroll-adjacent
depends: [03]
---
# 04 Audit trail for payout removals (O3)
## Goal
Removing a commission payout leaves a permanent record of who removed which payout and its full values.
## Context
Read `00-shared-context.md`. Decision D8. `removePayout` in `src/app/(app)/commission/actions.ts:114-131` hard
deletes from `commission_payouts`. Find that table's migration for its columns and who may read it.
New table `commission_payout_removals` (id, payout_id, payout jsonb snapshot, removed_by default auth.uid(),
removed_at default now()). AFTER DELETE trigger on `commission_payouts`, SECURITY DEFINER, `search_path = ''`.
No insert/update/delete grants to authenticated (trigger writes it). Select for the same roles that can pay out
commission (reuse the existing policy helper), plus the restrictive left-people policy.
## Files to touch
New migration; `supabase/tests/commission-payout-removals.test.ts`; `commission/actions.ts` only if it needs `logServerError`.
## Acceptance
- PGlite test: delete as a pay-out role writes one removal row with the snapshot and actor; a staff role cannot
  read or insert removals.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
A UI to view removals.
