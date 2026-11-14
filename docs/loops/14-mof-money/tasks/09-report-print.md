---
model: sonnet
effort: medium
why: Print layout reuse and a label change
depends: [08]
---
# 09 Report print + BD retitle
## Goal
"Print report": A4 via `src/components/app/print-layout.tsx` with Prepared / Reviewed / Acknowledged signatures. BD report
titled "Marketing director monthly report".
## Files to touch
- `src/app/(app)/reports/report-print.tsx` (new), `report-view.tsx`
## Acceptance
- Checks pass; Chrome print preview matches the demo's form.
