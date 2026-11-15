---
model: sonnet
effort: medium
why: Translations and seed rows following patterns
depends: [02, 03, 05, 06, 08, 10]
---
# 11 Strings + dev seed
## Goal
Chinese (and BM where the site role sees it) strings; dev seed: installers, DOs incl. a voided one, samples with a
pickup form, leftovers in every status.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Seed runs clean on a fresh local database.
