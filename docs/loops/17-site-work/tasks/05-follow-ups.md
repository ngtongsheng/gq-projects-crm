---
model: sonnet
effort: high
why: Normal feature work on existing follow-up parts
depends: [01]
---
# 05 Follow-ups
## Goal
Problem follow-up owner (Client, Charge, Purchasing, Installer), due date, note; "still waiting" log with snooze 1/2/5
working days. Extend `src/app/(app)/site-work/follow-up-parts.tsx`.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: snooze skips Sundays and public holidays. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px.
