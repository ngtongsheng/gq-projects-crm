---
model: sonnet
effort: medium
why: Mechanical translation and seed rows following existing patterns
depends: [02, 03, 04, 06, 07, 08, 09]
---
# 10 Chinese strings + dev seed
## Goal
Chinese strings for HR, Tools and the new People parts (loop 11 i18n, demo `ZHEN` ~1913); dev seed with sample
packages, per-year targets, policy documents and one handover.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass; seed runs clean on a fresh local database.
