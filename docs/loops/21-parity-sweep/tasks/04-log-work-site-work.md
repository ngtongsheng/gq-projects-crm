---
tier: standard
why: browser parity across several roles and widths, with judgment on fix vs log
depends: [01]
---
# 04 Parity: loop 17 Log work, Site Work
## Goal
Every screen below passes parity for each role that sees it at 1280 and 390 px, or each difference is fixed, logged as
deliberate, or listed for loop 22.
## Context
- Procedure: `docs/loops/21-parity-sweep/assets/parity-procedure.md` (follow it exactly).
- Built in Loop 17. Spec and known deviations: `docs/office-parity/drift-site-stock.md` (Log work, Site Work) and `docs/decisions.md` "Loop 17".
## Screens
- Log work (`/today`): site role landing, 4-step wizard, away days, banners; site role and site who sells; BM strings.
- Site Work (`/site-work`, `/site-work/[mofId]`): all tabs, new-MOF banner, MOF summary, shooting requests; md,
  support, site, marketing (Photos & videos, two tabs only).
## Check first
The list under "Browser parity still to run (after go-live)" in `docs/office-parity/drift-site-stock.md`, every item.
## Files to touch
App files for small fixes (≤3 per fix), `docs/decisions.md`, `docs/office-parity/drift-after-sweep.md`,
`docs/loops/21-parity-sweep/reports/04-log-work-site-work.md`.
## Steps
Per the procedure, screens in the order listed.
## Acceptance
- Report file has a filled checklist for every screen × persona × width.
- Every ✗ has a matching fix, a `docs/decisions.md` line, or a `drift-after-sweep.md` row.
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Integration items (banners, nav badges, WhatsApp sending, PWA), new features, data migrations.
