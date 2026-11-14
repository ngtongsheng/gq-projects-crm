---
model: sonnet
effort: medium
why: Nav entries, translations and seed rows following patterns
depends: [03, 04, 06, 07, 08]
---
# 09 Site nav, BM strings, dev seed
## Goal
Site nav: Log work, My schedule, Site Work, My Report, Tasks, Leave, with
BM labels (loop 11 i18n, demo `tr()`). Dev seed: logs for each activity, one without MOF, follow-ups, shoot request.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Seed runs clean on a fresh local database.
