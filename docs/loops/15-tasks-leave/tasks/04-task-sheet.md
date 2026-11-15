---
model: sonnet
effort: high
why: Normal UI work; reuses storage upload and task-flow actions
depends: [02]
---
# 04 Task sheet
## Goal
Task sheet as demo: details, log, file upload with versions (D6), review panel (approve / revision with comment) for
assigner or md only.
## Context
- Demo task sheet in `vTasks` ~3104. `src/lib/storage/` for upload and signed URLs.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role, desktop + 390px.
