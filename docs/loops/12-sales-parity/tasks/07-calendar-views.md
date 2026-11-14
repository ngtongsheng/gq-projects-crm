---
model: sonnet
effort: high
why: Several views with date maths and team filter; parity-heavy
depends: [05, 06]
---
# 07 Calendar views, My team filter, Plan a call
## Goal
`/calendar` has the demo's Week, Monthly list and Weekly outcomes tabs (Weekly outcomes body in task 08), the "Who"
filter with "My team", and "Plan a call" with a today's-calls strip on the calendar page.
## Context
- Demo `vCal()` ~2110-2150, Plan a call ~2077, ~2119.
- Params: `calendar/calendar-params.ts` (+ test). Team helpers from loop 11. Workdays: `src/lib/domain/workdays.ts`.
- D2: the on-leave strip and dashboard banner are out.
## Files to touch
- `src/app/(app)/calendar/calendar-params.ts` (+ test)
- `src/app/(app)/calendar/page.tsx`
- `src/app/(app)/calendar/week-view.tsx`, `monthly-list.tsx` (new or split from page)
- `src/app/(app)/calendar/plan-call-dialog.tsx` (new)
## Acceptance
- Checks pass. Parity for md, director, sales (desktop + 390px).
## Out of scope
Weekly outcomes body; leave strip.
