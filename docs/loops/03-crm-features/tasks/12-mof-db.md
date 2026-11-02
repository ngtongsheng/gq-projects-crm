---
model: opus
effort: medium
why: biggest table, column privacy and stage rules
depends: [10]
---
# 12 Order register (MOF) data, private cost
## Goal
MOFs and their product lines exist in the database; cost lives in a separate table only managers read; register editors are md, support and accounts.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `MOF`, `LOA`, `retention`, `Unijoy`, `S&L`, `contract sum`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_mofs.sql
- src/app/(app)/mofs/schemas.ts (+ test)
- src/lib/domain/mof-totals.ts (+ test)
## Steps
1. Read the prototype MOF form and register (anchors) before modelling.
2. Tables: `mofs` (mof_no unique, loa_date, salesperson_id, second_salesperson_id, project_id, company/project name, loa_no, quote_no, site address/contact, office_pic_id, customer and accounts contacts, scope check s_and_l/supply/labour, installer name, contract_sum, vo_amount, retention_pct, invoice_no, invoice_date, commission_type, delivery_date, stage check of the 11 stages, 4 pre-proceed booleans, timestamps); `mof_lines` (mof_id, product, stock_type check stock/indent/custom, supplier, qty, unit sqft/m2/roll/pcs, area_m2); `mof_costs` (mof_id pk, cost) ; `mof_total_changes` (mof_id, old_total, new_total, reason, changed_by).
3. RLS: mofs/lines readable by all; salespeople see their own as 'My Sales' (filter in UI, not RLS); write for md/support/accounts. mof_costs: select/insert/update only `is_manager()`.
4. Trigger: updating contract_sum or vo_amount requires a row in mof_total_changes in the same transaction; simplest durable form is a security-definer function `update_mof_total(mof_id, contract_sum, vo, reason)` and no direct update grant on those two columns.
5. `mof-totals.ts`: total = contract_sum + vo; total area m2 from lines; `needsSupplierPo(lines, totalM2)` (indent or custom line, or >= 1000 m2).
## Acceptance
- Tests: totals, area conversion, needsSupplierPo boundaries.
- Schema tests: a non-manager profile check is covered in the action tests of #13.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
UI.
