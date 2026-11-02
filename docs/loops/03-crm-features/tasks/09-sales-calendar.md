---
model: sonnet
effort: high
why: calendar grid without a library
depends: [08]
---
# 09 Sales calendar
## Goal
Sales Calendar shows activities by month and week, filtered to me or (managers) anyone; clicking a day adds an activity.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Sales Calendar`, `calendar`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/calendar/page.tsx
- src/components/app/month-calendar.tsx
- src/lib/domain/calendar-grid.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. `calendar-grid.ts`: weeks of a month (Monday start) in Malaysia time, pure and tested. No date or calendar dependency.
2. `MonthCalendar` app component (CSS grid, theme tokens) reused by #18; week view as a list. Add to `/dev/components`.
3. Month/week switch and person filter via URL params validated with zod.
## Acceptance
- Test: grid for a month starting on Sunday, February in a leap year.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Drag to reschedule.
