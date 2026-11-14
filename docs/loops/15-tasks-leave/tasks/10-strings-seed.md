---
model: sonnet
effort: medium
why: Mechanical translation and seed rows following existing patterns
depends: [03, 04, 08, 09]
---
# 10 Chinese strings + dev seed
## Goal
Chinese strings for Tasks and Leave (loop 11 i18n, demo `ZHEN` ~1913 for wording); dev seed with sample tasks in every
status and leave requests in every status for 2027.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass; seed runs clean on a fresh local database.
