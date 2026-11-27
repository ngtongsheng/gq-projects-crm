---
tier: frontier
why: concurrency and error-path changes need judgment to stay behavior-preserving
depends: [08]
---
# 09 Fix: performance, robustness, error handling
## Goal
Findings tagged `fix: 09` are fixed: serial independent awaits parallelised, swallowed errors handled or logged via
`logServerError`, missing boundary validation added where it only rejects input that would already fail.
## Context
Read `00-shared-context.md` and the report rows tagged `fix: 09`. Patterns from loops 23-24: `Promise.all` for
independent queries, React `cache()` per request, `logServerError` (find it with grep).
## Files to touch
The files those findings cite, ~8 max (D5). Beyond the cap: retag `debt`. No migrations (an index is a migration:
debt).
## Steps
1. Fix by rank. For each concurrency change, confirm the awaits are truly independent (no ordering, no shared write).
2. Add a regression test for each robustness fix that changes an error path.
3. Mark each finding in the report.
## Acceptance
`pnpm check && pnpm typecheck && pnpm test && pnpm build` pass. Every `fix: 09` row is marked.
## Out of scope
Schema/index changes, UI changes, new features.
