---
model: sonnet
effort: high
why: CRUD with status workflow
depends: [20]
---
# 22 Stock returns / leftover
## Goal
Site supervisors record leftover stock from a site (condition, destination, status); purchasing tracks pickup, return and credit notes.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `offcut`, `Left with client`, `Disposed`, `credit note`, `Best Link for resale`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_leftovers.sql
- src/app/(app)/stock/leftover/page.tsx
- src/app/(app)/stock/leftover/actions.ts (+ test)
- src/app/(app)/site-work/[mofId]/page.tsx
## Steps
1. Table `leftovers` (mof_id, item, qty, unit, condition, destination supplier/gq, status check of 5, credit_note_no, credit_note_amount). RLS: read all; insert site/support/managers; status updates support/managers.
2. Recorded from the site work page; listed under Stock.
## Acceptance
- Tests: credit note fields required when status is Returned to supplier (verify in prototype).
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Stock items (#23).
