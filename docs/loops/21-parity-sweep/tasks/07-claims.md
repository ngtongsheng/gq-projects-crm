---
tier: standard
why: browser parity across several roles and widths, with judgment on fix vs log
depends: [01]
---
# 07 Parity: loop 19 Claims
## Goal
Every screen below passes parity for each role that sees it at 1280 and 390 px, or each difference is fixed, logged as
deliberate, or listed for loop 22.
## Context
- Procedure: `docs/loops/21-parity-sweep/assets/parity-procedure.md` (follow it exactly).
- Built in Loop 19. Spec and known deviations: `docs/office-parity/drift-money-reports.md` (Claims) and `docs/decisions.md` "Loop 19".
## Screens
- Claims (`/claims`): my claim sections A-C, receipts, flags, submit gate; manager views; settings; Appeals tab;
  Overtime to decide; claim print. Commission's link to Appeals.
- `/overtime` deep link from Claims.
## Check first
The list under "Browser parity still to run, loop 19 (after go-live)" in `docs/office-parity/drift-money-reports.md`,
plus loop 19's log todo: embedded `profiles(...)` selects, `key:mof_id`/`key:id` aliases, md/accounts reads of
others' activities and site logs, checker expense update vs guard triggers, accounts deciding OT.
## Files to touch
App files for small fixes (≤3 per fix), `docs/decisions.md`, `docs/office-parity/drift-after-sweep.md`,
`docs/loops/21-parity-sweep/reports/07-claims.md`.
## Steps
Per the procedure, screens in the order listed.
## Acceptance
- Report file has a filled checklist for every screen × persona × width.
- Every ✗ has a matching fix, a `docs/decisions.md` line, or a `drift-after-sweep.md` row.
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Integration items (banners, nav badges, WhatsApp sending, PWA), new features, data migrations.
