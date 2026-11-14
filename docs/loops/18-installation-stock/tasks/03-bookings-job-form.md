---
model: sonnet
effort: high
why: Normal feature work
depends: [01]
---
# 03 Supervisor bookings + job form extras
## Goal
Site supervisors view: booking Requested / Confirmed / Declined with reply. Job form: installer picker, team incl.
"Supervisor only", salesperson in charge, remarks.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: booking state changes per role. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px.
