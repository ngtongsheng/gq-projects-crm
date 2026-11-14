---
model: sonnet
effort: high
why: Normal UI work on top of existing components
depends: [02]
---
# 03 Tasks page: tabs + tiles
## Goal
`/tasks` (registered in `src/lib/auth/pages.ts`): tabs My tasks, Assigned by me, All tasks, Workload (md/director);
tiles overdue, due this week, revision; New task sheet. Layout, labels and columns as demo `vTasks`.
## Context
- `docs/design-system.md`, `/dev/components`. Parity: `docs/office-parity/parity.md`.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role that sees it, desktop + 390px.
