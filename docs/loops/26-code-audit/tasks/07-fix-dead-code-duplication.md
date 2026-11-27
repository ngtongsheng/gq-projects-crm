---
tier: frontier
why: multi-file refactor; extracting shared code without changing behavior
depends: [06]
---
# 07 Fix: dead code and duplication
## Goal
Findings tagged `fix: 07` are fixed with no behavior change.
## Context
Read `00-shared-context.md` and the report rows tagged `fix: 07`.
## Files to touch
The files those findings cite, ~8 max (D5). Findings beyond the cap: retag `debt`.
## Steps
1. Dead code first (delete unused exports/files/deps), then duplication by rank. Reuse an existing helper before
   writing a new module; a new module gets one responsibility and a domain name.
2. Existing tests must still pass unchanged; add a test only where an extracted helper holds logic (money, dates,
   permissions, parsing) that had no test.
3. Mark each finding in the report: `fixed in <short sha>` or retagged `debt`.
## Acceptance
`pnpm check && pnpm typecheck && pnpm test && pnpm build` pass. `pnpm dlx knip` shows no confirmed item from the
report. Every `fix: 07` row is marked.
## Out of scope
Behavior changes, migrations, findings tagged 08/09.
