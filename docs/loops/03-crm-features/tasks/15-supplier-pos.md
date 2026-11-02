---
model: sonnet
effort: high
why: sub-table with derived requirement and ETA
depends: [14]
---
# 15 Supplier PO tracking
## Goal
On a MOF that needs it, purchasing records supplier POs with status and ETA; the register flags MOFs needing a PO that have none.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Zoho`, `At Best Link`, `lead time`, `ETA`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_supplier_pos.sql
- src/app/(app)/mofs/[id]/supplier-pos.tsx
- src/app/(app)/mofs/supplier-po-actions.ts (+ test)
- src/lib/domain/supplier-po.ts (+ test)
## Steps
1. Table `supplier_pos` (mof_id, zoho_no 4 digits, po_no generated = mof_no || '-' || zoho_no or as the prototype formats it, supplier, po_date, lead_time_days, status check of 8, notes). RLS: read all; write md/support/accounts.
2. `supplier-po.ts`: ETA = po_date + lead_time_days; overdue when ETA passed and not Delivered.
## Acceptance
- Tests: PO number format, ETA, overdue.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Emailing suppliers (mailto link only if the prototype has one).
