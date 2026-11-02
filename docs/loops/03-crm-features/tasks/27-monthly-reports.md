---
model: opus
effort: medium
why: auto stats from many tables plus review workflow and due dates
depends: [08, 11, 14, 21]
---
# 27 Monthly reports (sales, BD, site)
## Goal
Each salesperson, the BD director and site supervisors fill a monthly report prefilled with their stats; they submit; the director or MD reviews; late reports are flagged.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `My Report`, `Submitted`, `Reviewed`, `first Monday`, `highlights`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_monthly_reports.sql
- src/app/(app)/reports/page.tsx
- src/app/(app)/reports/actions.ts (+ test)
- src/lib/domain/report-stats.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. Table `monthly_reports` (profile_id, month date first-of-month, kind sales/bd/site, stats jsonb snapshot at submit, highlights, status draft/submitted/reviewed, submitted_at, reviewed_by, reviewed_at, review_note), unique (profile_id, month). Settings `report_due_time`=09:00 and site targets in app_settings.
2. `report-stats.ts`: pure from rows: visits vs target, new customers, quotations, awarded value, pass-down sales (bd), site visits/shootings/handovers/OT hours (site). Due = first Monday of next month at due time; late if submitted after.
3. Review: md/director for sales and site; md for bd.
## Acceptance
- Tests: stats per kind, due/late boundaries.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Director report (#28).
