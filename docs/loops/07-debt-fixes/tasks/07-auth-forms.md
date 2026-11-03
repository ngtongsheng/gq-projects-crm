---
model: sonnet
effort: high
why: auth flow change (session reuse) plus moving three useActionState forms to the shared keep-values helper
depends: []
---
# 07 Set-password retry (45) + forms keep values (59)
## Goal
A failed password save can be retried without a new link; sign-in, set-password and add-person keep typed values
(except passwords) when a save is refused.
## Context
- Source: loop 05 findings 45 and 59, and their `docs/debt.md` rows.
- `src/app/(auth)/set-password/actions.ts`: `verifyOtp` spends the link, then `updateUser`. Fix: if the request
  already has a session for that user (opened by an earlier `verifyOtp`), skip `verifyOtp` and only `updateUser`;
  change the failure message so it no longer says the link is used.
- Keep-values helper: `src/lib/form/submit-keeping-values.ts` (loop 05 #10, used by 21 forms). Reuse it.
- Sign-in must still show one message for wrong email or password (no account enumeration).
## Files to touch
- `src/app/(auth)/set-password/actions.ts` (+ test), set-password form, sign-in form, add-person form under `src/app/(app)/people/`
- `docs/debt.md` (remove the two rows)
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass.
- Test: second submit after a failed `updateUser` does not call `verifyOtp` again.
## Out of scope
- Supabase email templates.
