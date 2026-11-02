---
model: sonnet
effort: high
why: time maths across midnight
depends: [20]
---
# 21 Overtime claims + approval
## Goal
Staff submit OT (date, from/to, project, reason, OT claim or replacement leave); MD or director approve or reject; hours are calculated.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Replacement leave`, `OT claim`, `overtime`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_ot_claims.sql
- src/app/(app)/overtime/page.tsx
- src/app/(app)/overtime/actions.ts (+ test)
- src/lib/domain/ot-hours.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. Table `ot_claims` (profile_id, work_date, from_time, to_time, hours generated or stored, mof_id, reason, claim_as check ot/replacement_leave, status pending/approved/rejected, decided_by, decided_at). RLS: own read/insert; md/director/accounts read all; md/director decide.
2. `ot-hours.ts`: hours from times, crossing midnight, rounded to 0.5 the way the prototype rounds (verify up/nearest).
## Acceptance
- Tests: midnight crossing, rounding, only md/director decide.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Payroll export.
