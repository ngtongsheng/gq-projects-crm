---
tier: standard
why: browser parity across several roles and widths, with judgment on fix vs log
depends: [01]
---
# 06 Parity: loop 18 Stock, Samples, Leftover
## Goal
Every screen below passes parity for each role that sees it at 1280 and 390 px, or each difference is fixed, logged as
deliberate, or listed for loop 22.
## Context
- Procedure: `docs/loops/21-parity-sweep/assets/parity-procedure.md` (follow it exactly).
- Built in Loop 18. Spec and known deviations: `docs/office-parity/drift-site-stock.md` (Stock, Samples, Leftover) and `docs/decisions.md` "Loop 18".
## Screens
- Stock (`/stock`): tiles, segments with counts, Email suppliers dialog, status notices.
- Samples (`/samples`): pickups, numbering, receipt print.
- Leftover (`/stock/leftover`): allocations, Show sold out, dialogs.
## Check first
The Stock, Samples and Leftover items under "Browser parity still to run, loop 18" in `docs/office-parity/drift-site-stock.md`.
## Files to touch
App files for small fixes (≤3 per fix), `docs/decisions.md`, `docs/office-parity/drift-after-sweep.md`,
`docs/loops/21-parity-sweep/reports/06-stock-samples-leftover.md`.
## Steps
Per the procedure, screens in the order listed.
## Acceptance
- Report file has a filled checklist for every screen × persona × width.
- Every ✗ has a matching fix, a `docs/decisions.md` line, or a `drift-after-sweep.md` row.
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Integration items (banners, nav badges, WhatsApp sending, PWA), new features, data migrations.
