---
model: sonnet
effort: high
why: Normal UI work over leave maths and approval actions
depends: [06, 07]
---
# 08 Leave page
## Goal
`/leave`: My leave (balance tiles, apply sheet with slip upload), Waiting for approval, Team leave (md, director,
accounts). Layout and labels as demo `vLeave` ~3206.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role, desktop + 390px.
