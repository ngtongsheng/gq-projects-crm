---
model: sonnet
effort: high
why: Monthly sales attribution is money logic used by several screens
depends: [01]
---
# 02 VO sales month
## Goal
Each VO's amount counts as sales in its confirmed month (D2) in MOF summary and sales performance.
## Context
- Demo `salesPieces`. Domain: `src/lib/domain/mof-summary.ts`, `sales-performance.ts`, `report-stats.ts`.
## Files to touch
- those domain files (+ tests), their loaders if the VO rows must be fetched
## Acceptance
- Checks pass; tests: VO in a later month moves only its amount; backfilled VO stays in the MOF month.
## Out of scope
Commission (collection-based).
