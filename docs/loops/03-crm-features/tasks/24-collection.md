---
model: sonnet
effort: high
why: money with a 90% threshold
depends: [14]
---
# 24 Collection (payments, outstanding)
## Goal
Collection lists awarded MOFs with invoice, received, outstanding and status; md and accounts record payments.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Collection`, `Fully paid`, `90%`, `outstanding`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_payments.sql
- src/app/(app)/collection/page.tsx
- src/app/(app)/collection/actions.ts (+ test)
- src/lib/domain/collection.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. Table `payments` (mof_id, amount > 0, received_on, note). RLS: read managers + the MOF's salespeople; write md/accounts.
2. `collection.ts`: received, outstanding, pct paid, status Fully paid / 90%+ / x% paid, on cents. Invoice amount = MOF total (verify).
## Acceptance
- Tests: 89.99% vs 90%, overpayment, zero invoice.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Bank import.
