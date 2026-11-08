---
model: haiku
effort: low
why: One small piece of sign-in form copy and state
depends: []
---
# 07 Forgot password message
## Goal
The sign-in page has a "Forgot password?" control that shows: "Ask your admin to send you a new password link."
## Context
Decision D10. Admins already make the link on the People page. No emails are sent.
## Files to touch
- `src/app/(auth)/sign-in/sign-in-form.tsx`
- `docs/features.md`
## Steps
1. Confirm `src/app/(app)/people/new-link-dialog.tsx` is the existing admin flow.
2. Add a ghost or link-style button in the form that reveals the message. It must be `type="button"` so it never submits the form.
3. Note the behaviour in `docs/features.md`.
## Acceptance
`pnpm check`, `pnpm typecheck`, `pnpm test` pass. `pnpm dev`: clicking "Forgot password?" shows the message and does not submit.
## Out of scope
Sending email, a reset page, changes to the new-link flow.
