---
model: sonnet
effort: high
why: reuse MonthCalendar; phone layout
depends: [09, 17]
---
# 18 Installation calendar
## Goal
Installation calendar shows jobs by day with type and status; site supervisors see theirs on a phone; purchasing adds and moves jobs.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Installation Calendar`, `Delivery & Installation`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/installation/page.tsx
- src/app/(app)/installation/job-list.tsx
- src/lib/auth/nav-sections.ts
## Steps
1. Reuse `MonthCalendar`; below 640px show a day list instead of the grid.
2. Nav label per role (Installation / Delivery & Installation / Installation Calendar).
## Acceptance
- Manual: 390px width renders the day list (record in Log).
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Route planning.
