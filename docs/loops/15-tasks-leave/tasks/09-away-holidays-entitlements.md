---
model: sonnet
effort: high
why: Normal UI work; month grid can reuse calendar-grid
depends: [08]
---
# 09 Who is away, holidays, entitlements
## Goal
Who is away (month view), Public holidays tab (admin edits the loop 11 table), entitlement editor sheet (al, carry, mc
per person per year, demo ~3245) for md and accounts.
## Context
- `src/lib/domain/calendar-grid.ts`, existing public holidays UI from loop 11 (move, don't copy).
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role, desktop + 390px.
