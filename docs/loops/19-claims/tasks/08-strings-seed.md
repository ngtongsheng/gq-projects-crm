---
model: sonnet
effort: medium
why: Translations and seed rows
depends: [04, 05, 06, 07]
---
# 08 Strings + dev seed
## Goal
Chinese and BM strings for Claims; dev seed: claims in each status with flags and receipts.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Seed runs clean on a fresh local database.
