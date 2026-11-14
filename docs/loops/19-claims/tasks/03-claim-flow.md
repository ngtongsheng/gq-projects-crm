---
model: opus
effort: medium
why: State machine with role permissions and report gate
depends: [01]
---
# 03 Claim flow + gates
## Goal
Server actions per D1 (submit, check, approve, return, pay) and D6 gate; every change logged.
## Files to touch
- `src/lib/domain/claim-flow.ts` (+ test), claims server actions
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: each transition per role; own claim not approvable; gate blocks submit without last month's report.
