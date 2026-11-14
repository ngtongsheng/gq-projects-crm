---
model: sonnet
effort: high
why: Feature with accept/decline state and calendar rendering
depends: [04]
---
# 06 Appointment invitations
## Goal
A salesperson invites colleagues to an activity; invitees accept or decline; the calendar shows pending ones as
dashed-yellow events and "+ Name ?" tags, as in the demo.
## Context
- Demo `inv:` ~3167, ~4918; calendar rendering in `vCal()` ~2110-2150.
- D2: no dashboard banner or nav badge here.
## Files to touch
- `src/app/(app)/calendar/add-activity-dialog.tsx`
- `src/app/(app)/calendar/invitation-actions.ts` (new) + test
- `src/app/(app)/calendar/page.tsx` (event styling)
## Acceptance
- Checks pass; tests: only the invitee can answer their invitation; declined invitee no longer sees it as pending.
## Out of scope
Banners and badges.
