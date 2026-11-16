---
tier: standard
why: concurrency handling with a regression test; behaviour must stay correct for every error code
depends: []
---
# 04 Leave entitlement: handle the concurrent insert
## Goal
Two editors saving the same person and year at the same time both succeed (the later values win) instead of the second
seeing "Could not save. Try again."
## Context
Audit B1, verified: `saveEntitlement` in `src/app/(app)/leave/entitlement-actions.ts` (lines ~74-90) updates the row, and
when no row changed inserts one. If another request inserted between those two steps, the insert hits the primary key
(Postgres 23505) and `fail()` maps it to the generic TRY_AGAIN. The table has no upsert grant on its key (existing
comment), so no upsert. Decision D5: when the insert returns 23505, run the same update once more and return its result.
No migration.
## Files to touch
- `src/app/(app)/leave/entitlement-actions.ts`
- `src/app/(app)/leave/entitlement-actions.test.ts`
## Steps
1. Read both files and match how the test mocks the Supabase client.
2. Write the failing test first: update finds no row, insert returns `{ code: "23505" }`, second update succeeds; action
   returns `{ error: null }`. Add a case where the retried update also fails and the error maps as before.
3. Implement the retry; keep `fail()` for every other code.
## Acceptance
- `pnpm test src/app/\(app\)/leave/entitlement-actions.test.ts` passes, with the new test failing before the fix.
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Other leave actions, a database change.
