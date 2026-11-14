---
model: sonnet
effort: high
why: Biggest UI screen: revision tabs, option cards, item tables by category with type-specific inputs
depends: [03]
---
# 05 Quote record editor
## Goal
`/costing/[id]`: revision tabs (Original/R1/R2), option cards A/B/C with sell, cost, margin (gated per D3), item
tables by category with type-specific inputs, fx USD/RMB, SST, target margin; save in editable statuses.
## Context
- Demo GQC quote record screen. Maths from `src/lib/domain/costing.ts`; loader from task 03.
- Action bar buttons for the approval flow are added in task 06; leave the slot.
- D3 applies in the editor: a viewer without the margin flag (default salespeople) sees and edits sell-side fields only (product, supplier, qty, unit, rate, sell) and the Low/High margin pill; cost inputs, fx, SST, target margin and wastage are not rendered and the save action ignores them (cost stays as the flag holder keyed it). Use `quote-data.ts` loaders (task 03).

- `createQuote` (task 04) inserts quote, revision 0, Option A and history one after another; a failure midway leaves a quote with no revision. The editor must cope: show a plain message and offer to create the missing draft revision.

## Files to touch
- `src/app/(app)/costing/[id]/page.tsx` (new), `option-card.tsx`, `item-table.tsx` (new)
- `src/app/(app)/costing/[id]/revision-actions.ts` (new) + test
## Acceptance
- Checks pass; tests: save refused when approved; totals recomputed server-side, not trusted from the client.
  Parity for md and sales (desktop + 390px), and a user without margin flag.
## Out of scope
Approvals, FOB, preview.
