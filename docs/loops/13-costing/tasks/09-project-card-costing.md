---
model: sonnet
effort: high
why: Cross-module link that writes the project value; gated by page access
depends: [06]
---
# 09 Project card costing lines
## Goal
Project card shows quotes for that project (status, option totals), "Open costing", and "Use RM X as project value"
when a revision is approved and the project has no MOF. Hidden without `cost` page access.
## Context
- Demo `costLines(p)` ~1922, used ~4962. Project card: `src/app/(app)/projects/customer-projects.tsx` /
  `pipeline-board.tsx`. D7: do not edit `project-access.ts` or `project-filters.ts` (loop 12 owns them).
- `projects.value` numeric(14,2).
## Files to touch
- `src/app/(app)/projects/project-costing-lines.tsx` (new), the card component
- `src/app/(app)/costing/use-as-project-value-action.ts` (new) + test
## Acceptance
- Checks pass; tests: refused when a MOF exists or the revision is not approved. Parity for md and sales.
## Out of scope
MOF changes.
