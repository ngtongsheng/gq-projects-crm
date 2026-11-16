---
tier: standard
why: hot path for every page; small diff but must keep the exact conditional and view-as behaviour
depends: []
---
# 01 Layout: run independent awaits in parallel
## Goal
`src/app/(app)/layout.tsx` no longer waits for `countPendingOwnershipRequests()`, `loadAccessOverrides()`,
`resolveLanguage()` and `isViewingAs()` one after another. Output is identical.
## Context
Audit P1, verified: after `requireRole("staff")` the layout awaits the pending-request count (only when
`canDecideOwnership(profile.jobRole)`), then `resolveLanguage`, then `loadAccessOverrides`, then `isViewingAs`, then
`readImpersonation` (only when viewing). They do not depend on each other; `readImpersonation` depends on `isViewingAs`.
`nav` needs the count, language and overrides.
## Files to touch
- `src/app/(app)/layout.tsx`
## Steps
1. Read the file. Keep `requireRole("staff")` first (it redirects).
2. One `Promise.all` for: pending count (still `0` when the role cannot decide), `resolveLanguage(profile.language)`,
   `loadAccessOverrides()`, `isViewingAs()`.
3. Then `readImpersonation()` only when viewing, as today. Keep the existing comment about badges.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- Diff touches only the layout; no behaviour or markup change.
## Out of scope
Caching `requireRole`, the dashboard queries, any other layout change.
