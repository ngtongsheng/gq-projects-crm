---
tier: standard
why: small helper plus a mechanical adoption across ~40 calls on money/HR paths
depends: []
---
# 03 `logServerError` helper on money and HR paths (O4)
## Goal
Errors on money and HR server actions log who (profile id) and which record, so a Vercel log line is diagnosable.
## Context
Read `00-shared-context.md`. Decision D6. Today: `console.error("Could not ...", error)` with no context.
Helper: `logServerError(message: string, error: unknown, context: { profileId?: string; recordId?: string; [k]: string | undefined })`
in `src/lib/log-server-error.ts`. One structured line: message, context, error code/message/details. Never log
emails, phone numbers, IC numbers or money amounts.
Adopt in `src/app/(app)/` actions under: `claims`, `collection` (payments), `commission`, `leave`, `hr`, `overtime`.
The acting profile is already in scope in most actions (`requirePage` result).
## Files to touch
`src/lib/log-server-error.ts` + test; the `*actions.ts` files in the six folders above (mechanical).
## Steps
1. Write helper and unit test (output shape, no PII fields).
2. Replace `console.error` in those folders; pass profile and record ids where in scope.
## Acceptance
- `grep -rn "console.error" "src/app/(app)/"{claims,collection,commission,leave,hr,overtime}` returns nothing.
- `pnpm check && pnpm typecheck && pnpm test` pass (update tests that spy on `console.error`).
## Out of scope
The other ~150 calls (logged in debt by #11), log shipping.
