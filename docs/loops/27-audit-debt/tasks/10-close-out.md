---
tier: economy
why: doc edits from the loop log
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09]
---
# 10 Close out debt.md and the audit outcome
## Goal
`docs/debt.md` holds only what is still open, and the audit report records what loop 27 fixed.
## Context
Read `00-shared-context.md`, `../loop.md` (Log, Decisions D4) and `git log main..HEAD --oneline`.
## Files to touch
- `docs/debt.md` (loop 26 sections at the end)
- `docs/audits/2026-11-27-code-audit-round-3.md` (add `## Loop 27 outcome` after `## Loop 26 outcome`)
## Steps
1. In debt.md: delete the fixed parts of each loop 26 section (the paging loops, A3, A4, A10, A14, A15, A17, B2, B4,
   B5, B8, B9). Delete a section when nothing is left in it; keep A2, A5, A6, A12, A13, A16, B7, CLI 3 and TS7 as
   they are. Add any new debt that tasks logged.
2. In the audit: a table of task → commit → IDs, and a line listing what stays in debt.
## Acceptance
- `grep -nE "A3|A4|A10|A14|A15|A17|B2|B4|B5|B8|B9" docs/debt.md` returns nothing, unless a task logged it as
  not fixed.
- `pnpm check` passes.
## Out of scope
Code changes.
