---
model: opus
effort: medium
why: Aggregation per salesperson, review permissions (md / own team lead), deadline and lateness rules
depends: [05]
---
# 08 Weekly outcomes + weekly reports
## Goal
The Weekly outcomes tab: Mon-Sun navigator; per salesperson visits done / logged / not logged / late, results, new
leads, weekly report status, expandable visits; salesperson "Submit weekly report" (due per D6); md or team lead
"Mark reviewed".
## Context
- Demo ~2023, ~2118, ~4560-4570, ~4860-4875.
- Data from task 04; outcome rules from task 05.
## Files to touch
- `src/app/(app)/calendar/weekly-outcomes-data.ts` (new, pure aggregation) + test
- `src/app/(app)/calendar/weekly-report-actions.ts` (new) + test
- `src/app/(app)/calendar/weekly-outcomes.tsx` (new)
## Acceptance
- Checks pass; tests: counts per status, week boundaries (Mon-Sun, Asia/Kuala_Lumpur), late submission after
  deadline, review refused for a director outside the team. Parity for md, director, sales.
## Out of scope
Dashboard banners.
