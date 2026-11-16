---
tier: standard
why: auth/audit path; needs to respect impersonation read-only enforcement
depends: []
---
# 10 Sign-out closes the impersonation log row (S4)
## Goal
Signing out while viewing as someone sets `impersonation_log.ended_at`, same as stopping view-as.
## Context
Read `00-shared-context.md`. `src/lib/auth/sign-out.ts` clears the session but not the open log row.
`src/app/(app)/people/impersonate-actions.ts` already ends a session (find the stop function); reuse its ending
logic (extract a shared function if needed, not a copy). Mind `view-only-fetch.ts`: writes during view-as are
blocked; the ending write must use the same path stop-view-as uses.
## Files to touch
`src/lib/auth/sign-out.ts`, `impersonate-actions.ts`, their tests.
## Acceptance
- Test: sign-out with an impersonation cookie ends the log row and clears the cookie; without one, unchanged.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
S5 (`x-forwarded-host`).
