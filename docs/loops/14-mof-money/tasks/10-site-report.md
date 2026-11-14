---
model: sonnet
effort: high
why: Restructured report with itinerary maths and a print form
depends: [08]
---
# 10 Site report restructure
## Goal
Site report: (1) itinerary, one line per site per day, target n/50, scheduled vs added on the day, print form
(`printSrep`), schedule check (`pvdPanel`); (2) shooting and handover table; (3) remarks; stock-return counts. OT table
and activity summary removed.
## Context
- `docs/office-parity/drift-money-reports.md` "Reports" site report bullet. Data: `site_logs`, `site_bookings`, `leftovers`; `src/lib/domain/site-log.ts`, `report-stats.ts`.
## Files to touch
- `src/lib/domain/site-report.ts` (new, pure) + test, `src/app/(app)/reports/report-figures.tsx`, `report-data.ts`,
  `site-report-print.tsx` (new)
## Acceptance
- Checks pass; tests: itinerary counts, scheduled vs added. Parity for site and md.
