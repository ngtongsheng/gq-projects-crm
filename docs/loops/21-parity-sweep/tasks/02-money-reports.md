---
tier: standard
why: browser parity across several roles and widths, with judgment on fix vs log
depends: [01]
---
# 02 Parity: loop 14 money and reports
## Goal
Every screen below passes parity for each role that sees it at 1280 and 390 px, or each difference is fixed, logged as
deliberate, or listed for loop 22.
## Context
- Procedure: `docs/loops/21-parity-sweep/assets/parity-procedure.md` (follow it exactly).
- Built in Loop 14. Spec and known deviations: `docs/office-parity/drift-money-reports.md` and `docs/decisions.md` "Loop 14".
## Screens
- MOF Register and MOF detail: variation orders, additional-work alert, change history (`/mofs`, `/mofs/[id]`).
- Commission and its settings (`/commission`, `/commission/settings`), including the Appeals link to Claims.
- Sales Performance (`/performance`): drilldown, team chart.
- Reports: my report, Team Reports, Director Report, two-step review, print (`/reports`, `/reports/team`, `/reports/director`).
- Site report (restructured: itinerary, schedule check, shooting and handover, stock returns).
## Check first
- Two-step review: reviewer then md final approval, as accounts/director/md personas.
- Report print fits A4; BD retitle shows for the BD persona.
- Marketing Director cannot open Team Reports (known debt, not drift).
## Files to touch
App files for small fixes (≤3 per fix), `docs/decisions.md`, `docs/office-parity/drift-after-sweep.md`,
`docs/loops/21-parity-sweep/reports/02-money-reports.md`.
## Steps
Per the procedure, screens in the order listed.
## Acceptance
- Report file has a filled checklist for every screen × persona × width.
- Every ✗ has a matching fix, a `docs/decisions.md` line, or a `drift-after-sweep.md` row.
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Integration items (banners, nav badges, WhatsApp sending, PWA), new features, data migrations.
