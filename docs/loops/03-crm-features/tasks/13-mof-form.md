---
model: opus
effort: medium
why: large form with lines, money and guarded total changes
depends: [12]
---
# 13 MOF form
## Goal
Register editors create and edit a MOF with product lines, VO, retention, the four checks, and a reason prompt whenever the order total changes; managers see and edit cost.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `MOF form`, `pre-proceed`, `credit note`, `reason`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/mofs/[id]/page.tsx
- src/app/(app)/mofs/mof-form.tsx
- src/app/(app)/mofs/mof-lines-editor.tsx
- src/app/(app)/mofs/actions.ts (+ test)
## Steps
1. Create from an Awarded project (prefills customer, salesperson, value) or blank.
2. Lines editor: add/remove rows, sqft/m2 shown both ways.
3. Total change goes through `update_mof_total` with a required reason; history listed on the page.
4. Cost field rendered only for managers; the action for cost rejects others.
## Acceptance
- Tests: total change without reason rejected; cost write by sales rejected; validation of lines.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Register list (#14).
