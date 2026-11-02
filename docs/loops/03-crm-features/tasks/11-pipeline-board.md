---
model: sonnet
effort: high
why: board UI plus tested flags
depends: [10]
---
# 11 Pipeline board/list
## Goal
Projects screen shows a board by stage and a list, with Overdue and Stale flags and est. commission, filtered by person.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `stale`, `Overdue`, `est. commission`, `board`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/projects/page.tsx
- src/app/(app)/projects/pipeline-board.tsx
- src/lib/domain/project-flags.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. `projectFlags(project, today)`: overdue when next_action_date < today and stage open; stale when updated_at older than 14 days and stage open.
2. Est. commission uses a placeholder rate by account type until #25; keep it behind one function so #25 swaps it.
3. Stage change from the board via a select (no drag dependency).
## Acceptance
- Test: flags at boundaries; closed stages never flagged.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Drag and drop.
