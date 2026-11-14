---
model: opus
effort: medium
why: Business rules (required fields, lateness, follow-up creation, optional project lead) in one transaction
depends: [04]
---
# 05 Log outcome flow
## Goal
A done visit gets a "Log outcome" flag; logging it requires result and learnings (15+ chars), may create a project
lead, records late logging and creates the follow-up.
## Context
- Demo ~4797-4873 (outcome form, late rule, follow-up). Copy the late threshold exactly.
- Project lead creation reuses existing project actions in `src/app/(app)/projects/actions.ts`.
- Zod schema at the boundary; derive types from it.
## Files to touch
- `src/app/(app)/activities/outcome-schema.ts` (new) + test
- `src/app/(app)/activities/log-outcome-action.ts` (new) + test
- `src/app/(app)/activities/log-outcome-dialog.tsx` (new)
- the calendar/activity view that shows the flag
## Acceptance
- Checks pass; tests: learnings < 15 chars refused, late flag set past threshold, follow-up created, lead optional.
## Out of scope
Weekly outcomes view (task 08).
