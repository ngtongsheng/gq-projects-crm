---
tier: standard
why: careful but mostly mechanical: remove noise comments, split files along existing seams
depends: [07]
---
# 08 Fix: comments and oversized files
## Goal
Findings tagged `fix: 08` are fixed: noise and commented-out code removed, oversized files split by responsibility.
## Context
Read `00-shared-context.md` and the report rows tagged `fix: 08`. Keep why-comments (business rules, RLS reasons,
workarounds). Splits follow existing folder patterns (look at sibling feature folders); no barrel re-export files.
## Files to touch
The files those findings cite, ~8 max plus the new files a split creates (D5). Beyond the cap: retag `debt`.
## Steps
1. Comments: delete what-comments and commented-out code; keep or rewrite why-comments.
2. Splits: move code without changing it; update imports.
3. Mark each finding in the report.
## Acceptance
`pnpm check && pnpm typecheck && pnpm test && pnpm build` pass. Every `fix: 08` row is marked.
## Out of scope
Rewriting logic while splitting.
