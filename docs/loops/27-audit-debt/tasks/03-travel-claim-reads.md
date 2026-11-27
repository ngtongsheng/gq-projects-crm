---
tier: standard
why: race-path error handling and a narrowed query that must return the identical count
depends: []
---
# 03 Travel claim reads and logs, ready-to-release reads
## Goal
A15: claim settings and the claim lookup run in parallel. A14: after a 23505 race the second `find()` error is
logged, and a zero-row update logs a real message instead of a `null` error. A17: `countClaimsReadyToRelease`
starts `loadClaimPeople()` in parallel and reads only the months of the submitted claims. Every result stays the same.
## Context
Read `00-shared-context.md`. Audit rows A14, A15, A17.
## Files to touch
- `src/app/(app)/claims/travel-claim-actions.ts` (around lines 39, 63, 87-104)
- `src/app/(app)/claims/travel-claim-actions.test.ts`
- `src/app/(app)/claims/ready-to-release-data.ts` (around lines 20-32)
## Steps
1. A15: start the settings read and the claim lookup together.
2. A14: log the second `find()` error with `logServerError`; on a zero-row update log a descriptive message with
   the claim id instead of `saved.error`. The user-facing refusal stays the same.
3. A17: run the claims query and `loadClaimPeople()` together; filter monthly reports with `.in("month", months)`
   from the submitted claims (skip the query when there are none). The count must be identical.
4. Add or extend tests: the race path still returns the same result; ready-to-release returns the same count with
   reports from other months present. Use the existing test style in `src/app/(app)/claims/`.
## Acceptance
- `pnpm test src/app/\(app\)/claims` passes, including the new cases.
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
## Out of scope
A16 (the lock message wording).
