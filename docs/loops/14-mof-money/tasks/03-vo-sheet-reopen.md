---
model: opus
effort: medium
why: Rule that reopens a completed job and changes stage, percent and alerts
depends: [01]
---
# 03 VO sheet + needs-work reopen
## Goal
MOF page lists VOs with add/edit (demo `sheetVO`). A needs-work VO on a 100% job reopens it (95%, stage "Installation
in progress", register stage "Delivered – installing") and shows an "Additional work" alert to the job's site
supervisors until they click "OK, noted" (D7: in-app only).
## Context
- `docs/office-parity/drift-money-reports.md` VO bullet; demo `addWork`, `addWorkText`. Stages: `src/lib/domain/mof-stages.ts`, `site-stage.ts`.
  BM labels already in `src/lib/i18n/bm.ts` ("Additional work", "OK, noted").
## Files to touch
- `src/app/(app)/mofs/[id]/vo-sheet.tsx` (new), `vo-actions.ts` (new) + test
- migration for the alert acknowledgement if needed, site supervisor view showing the alert
## Acceptance
- Checks pass; tests: reopen only when needs_work and job at 100%; acknowledgement per supervisor. Parity for md,
  support, site.
