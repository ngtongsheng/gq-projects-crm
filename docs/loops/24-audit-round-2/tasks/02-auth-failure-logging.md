---
tier: standard
why: auth paths are sensitive; must log without changing who gets in
depends: []
---
# 02 Log auth failures loudly (O1, O7, S3)
## Goal
A Supabase auth outage, a missing `ALLOWED_EMAIL_DOMAINS`, or a missing impersonation secret each leave a clear
server log line. Access behaviour is unchanged (still fails closed).
## Context
Read `00-shared-context.md`. Decision D9.
- O1: `src/lib/supabase/middleware.ts:42` discards the `getClaims()` error; `src/lib/auth/current-profile.ts:51-53`
  same. Log the error (not "no session", which is normal) with path; keep redirect behaviour.
- O7: `src/app/auth/callback/route.ts:52` + `src/lib/auth/sign-in-decision.ts:39-40`: `parseAllowedDomains(undefined)`
  gives `[]`, refusing everyone silently. Log a config error when the env is missing/empty, and log each domain
  refusal (email domain only, never the full email).
- S3: `src/app/(app)/people/impersonate-actions.ts:83` uses `""` as HMAC secret when the service key is missing.
  Throw a clear error instead (verify still fails closed).
## Files to touch
The four files above, their tests.
## Steps
Tests first for `sign-in-decision` (missing env path) and the impersonation secret. Keep the "nothing between client
creation and getClaims" rule in middleware: log after the call.
## Acceptance
- New tests cover missing env and missing secret.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
Timeouts on Supabase calls (O2), alerting.
