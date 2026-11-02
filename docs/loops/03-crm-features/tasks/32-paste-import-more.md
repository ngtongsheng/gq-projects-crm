---
model: sonnet
effort: high
why: reuse #31 for three more lists
depends: [31, 13, 22, 23]
---
# 32 Paste import: MOFs, stock, leftover
## Goal
The paste import works for MOFs (with lines), stock items and leftover.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Paste from sheet`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/mofs/import-actions.ts (+ test)
- src/app/(app)/stock/import-actions.ts (+ test)
- src/app/(app)/stock/leftover/import-actions.ts
- page buttons
## Steps
1. Column mappings follow the prototype's paste formats (anchors).
2. MOF import goes through the same total-change rules for existing MOFs (update via function with reason 'Imported').
## Acceptance
- Tests: one mapping test per list; MOF update path records the reason.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Zoho sync.
