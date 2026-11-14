---
model: sonnet
effort: high
why: Normal UI work on the existing People page
depends: [05]
---
# 06 People: targets + Sales teams
## Goal
People person sheet: per-year sales and visit targets (shows grade default when empty). Sales teams panel (team lead
via `reports_to`, members, team target total) as demo `vPeople` ~4995.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role that sees People, desktop + 390px.
