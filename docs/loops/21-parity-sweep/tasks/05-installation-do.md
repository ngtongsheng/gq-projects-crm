---
tier: standard
why: browser parity across several roles and widths, with judgment on fix vs log
depends: [01]
---
# 05 Parity: loop 18 Installation and DOs
## Goal
Every screen below passes parity for each role that sees it at 1280 and 390 px, or each difference is fixed, logged as
deliberate, or listed for loop 22.
## Context
- Procedure: `docs/loops/21-parity-sweep/assets/parity-procedure.md` (follow it exactly).
- Built in Loop 18. Spec and known deviations: `docs/office-parity/drift-site-stock.md` (Installation) and `docs/decisions.md` "Loop 18".
## Screens
- Installation (`/installation`): views, installers list, supervisor booking.
- Delivery orders: numbering, lines, delivery log, DO print.
## Check first
The Installation, DO and Roles items under "Browser parity still to run, loop 18" in `docs/office-parity/drift-site-stock.md`.
Do not change the next DO number setting beyond what the seed set; record whether support and accounts can set it.
## Files to touch
App files for small fixes (≤3 per fix), `docs/decisions.md`, `docs/office-parity/drift-after-sweep.md`,
`docs/loops/21-parity-sweep/reports/05-installation-do.md`.
## Steps
Per the procedure, screens in the order listed.
## Acceptance
- Report file has a filled checklist for every screen × persona × width.
- Every ✗ has a matching fix, a `docs/decisions.md` line, or a `drift-after-sweep.md` row.
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Integration items (banners, nav badges, WhatsApp sending, PWA), new features, data migrations.
