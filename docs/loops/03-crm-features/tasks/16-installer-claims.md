---
model: sonnet
effort: high
why: money calculation with retention
depends: [14]
---
# 16 Installer POs + claims
## Goal
Each MOF records installer POs and their progress/final/deduction claims; site supervisors verify claims; accounts mark them paid; the amount due is calculated.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `installer PO`, `Deduction`, `back-charge`, `retention`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_installer_claims.sql
- src/app/(app)/mofs/[id]/installer-claims.tsx
- src/app/(app)/mofs/installer-actions.ts (+ test)
- src/lib/domain/installer-claim.ts (+ test)
## Steps
1. Tables `installer_pos` (mof_id, po_no, po_date, installer, amount, scope, retention_pct) and `installer_claims` (installer_po_id, type progress/final/deduction, amount, claimed_on, verified_by, verified_at, paid_on). RLS: read managers, support, site; write POs md/support/accounts; verify = site role; paid = md/accounts.
2. `installer-claim.ts`: due = claimed - deductions - retention% x claimed - paid, on cents.
## Acceptance
- Tests: due with and without deductions, retention, rounding.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Paying installers.
