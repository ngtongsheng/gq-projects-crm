---
model: opus
effort: medium
why: Field diff across many MOF fields, reason rule, cost gating
depends: []
---
# 04 MOF change history
## Goal
Every MOF save records field-level changes (contract, cost, installer, scope, pic, support, account type, LOA date,
items). Reason required when the job is complete or the order total changes. Cost rows hidden without cost access.
## Context
- `docs/office-parity/drift-money-reports.md` "Field-level change history"; demo `mofDiff`, `p.chg[]`. D5: copy `mof_total_changes` rows in, keep the table.
## Files to touch
- `supabase/migrations/<ts>_mof_changes.sql` (new) + RLS test
- `src/lib/domain/mof-diff.ts` (new, pure) + test
- the MOF save action, `src/app/(app)/mofs/[id]/change-history.tsx` (new)
## Acceptance
- Checks and `pnpm guard:migrations` pass; tests: diff per field, reason enforced server-side, cost rows absent for
  a user without cost access.
