---
model: opus
effort: medium
why: State machine with role rules (owner, md, director) and history; core business rule on margins
depends: [05]
---
# 06 Approval flow + Approvals page
## Goal
Lowest option >= min margin: owner confirms, no approval. Below: reason required, submit; md or director approve or
return with a note; then "OK to quote", owner picks the option or opens a revision. Every step writes history.
Approvals page "Below min margin" (pending + recent).
## Context
- Rules: drift doc "Costing" Rules bullet; demo GQC action bar and approvals screen.
- Migration 02 lets an owner move a revision to `approved` through the API (database cannot do margin maths). The server action must enforce: owner confirms only when the lowest option margin is at or above the min margin setting; otherwise submit for md/director. Add a lowest-margin-across-options helper to `costing.ts` (task 01 left it out).

- Reuse `lowestMargin`/`marginLevel` from `costing.ts` (task 03 added them). History notes reach restricted viewers unfiltered: never write margin % or cost figures into a note.

## Files to touch
- `src/lib/domain/quote-status.ts` (new, pure transitions) + test
- `src/app/(app)/costing/[id]/approval-actions.ts` (new) + test, action bar component
- `src/app/(app)/costing/approvals/page.tsx` (new)
## Acceptance
- Checks pass; tests: every allowed and refused transition per role, reason required below min, return needs a note,
  new revision copies options and items.
## Out of scope
Badges and banners (D5).
