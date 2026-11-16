---
tier: standard
why: browser parity across several roles and widths, with judgment on fix vs log
depends: [01]
---
# 03 Parity: loop 16 People, HR, Tools
## Goal
Every screen below passes parity for each role that sees it at 1280 and 390 px, or each difference is fixed, logged as
deliberate, or listed for loop 22.
## Context
- Procedure: `docs/loops/21-parity-sweep/assets/parity-procedure.md` (follow it exactly).
- Built in Loop 16. Spec and known deviations: `docs/office-parity/drift-new-modules.md` and `docs/decisions.md` "Loop 16".
## Screens
- People (`/people`): per-year targets and visit targets, resignation handover, Sales teams panel, access matrix.
- HR (`/hr`), md and accounts only: policies, staff packages, sales grades and bonus, outstation rules.
- Tools & Forms (`/tools`): wallpaper and vinyl calculators, A4 forms blank and pre-filled from an awarded MOF, links.
## Check first
- HR is unreachable for every other role, including via View as (loop 16 D1).
- Yearly targets rollover and resignation handover write correctly on the test copy (migrations `20261116120000`, `20261116130000`).
- Form prints fit one A4.
## Files to touch
App files for small fixes (≤3 per fix), `docs/decisions.md`, `docs/office-parity/drift-after-sweep.md`,
`docs/loops/21-parity-sweep/reports/03-people-hr-tools.md`.
## Steps
Per the procedure, screens in the order listed.
## Acceptance
- Report file has a filled checklist for every screen × persona × width.
- Every ✗ has a matching fix, a `docs/decisions.md` line, or a `drift-after-sweep.md` row.
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Integration items (banners, nav badges, WhatsApp sending, PWA), new features, data migrations.
