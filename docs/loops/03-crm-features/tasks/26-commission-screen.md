---
model: sonnet
effort: high
why: screen over #25 engine
depends: [25]
---
# 26 Commission screen + payouts
## Goal
Commission screen shows each person's earned and claimable commission per MOF; md and accounts record payouts; salespeople see only their own.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Commission`, `claim`, `paid out`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_commission_payouts.sql
- src/app/(app)/commission/page.tsx
- src/app/(app)/commission/actions.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. Table `commission_payouts` (profile_id, mof_id, amount, paid_on, note). RLS: own read; md/accounts read all and write.
2. Remaining = earned - paid out; screen groups by person, managers filter by person.
## Acceptance
- Tests: payout over remaining rejected; salesperson cannot read others.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Payroll.
