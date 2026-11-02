---
model: opus
effort: medium
why: multi-file refactors across modules (shared helpers, duplicated logic); blast radius across the app
depends: [04, 05, 06, 07, 08]
---
# 09 Cross-module fixes from findings
## Goal
Every `findings.md` row with status `cross-module (#09)` is fixed or routed to D4/debt.
## Context
- Rules: `docs/loops/05-audit-smoke/assets/audit-checklist.md`. Owner chose "fix everything" (loop 05 D3), so larger
  refactors are in scope, but no new dependencies and no destructive migrations (D4).
- Extract shared logic into a focused file in `src/lib/domain/` or `src/components/app/`, with tests for logic.
## Files to touch
- Files named by the `cross-module (#09)` rows; docs/loops/05-audit-smoke/findings.md; docs/debt.md
## Steps
1. `grep 'cross-module' docs/loops/05-audit-smoke/findings.md`; group rows that share a fix.
2. Per group: fix, run checks, commit, set the rows to `fixed (<sha>)`.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass.
- `grep -c 'cross-module (#09)' docs/loops/05-audit-smoke/findings.md` prints 0.
## Out of scope
New findings beyond the rows (add them as rows with status, fix only if small and in the same files).
