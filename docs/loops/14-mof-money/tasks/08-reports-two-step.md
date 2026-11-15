---
model: opus
effort: medium
why: Review state machine across roles with a backfill rule
depends: []
---
# 08 Reports two-step review
## Goal
D6: lead or md reviews, then md final approval; director reports to md only; submission shows "Goes to <lead> & <md>".
## Context
- `docs/office-parity/drift-money-reports.md` "Reports"; demo `leadOf`, `vickyOk`. Code: `src/app/(app)/reports/actions.ts`, `review-form.tsx`, `report-view.tsx`.
## Files to touch
- `supabase/migrations/<ts>_report_final_approval.sql` (new, backfill per D6) + test
- `src/app/(app)/reports/actions.ts` (+ test), `review-form.tsx`, `report-view.tsx`
## Acceptance
- Checks and `pnpm guard:migrations` pass; tests: lead outside team refused, final approval only after review, director
  report skips lead step.
