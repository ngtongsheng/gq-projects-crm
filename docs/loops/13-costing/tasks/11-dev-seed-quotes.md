---
model: sonnet
effort: medium
why: Seed data that exercises every status and item type for parity checks
depends: [02]
---
# 11 Dev seed: sample quotes
## Goal
`pnpm seed:example` adds the demo's sample quotes (from `seedCosting` in the demo) for the demo personas: each status,
each item type, one below min margin, one with an FOB enquiry.
## Files to touch
- `scripts/seed-example-data.ts` (or a new `scripts/seed-costing.ts` it calls)
- `quotes.project_id` is an FK that blocks deleting a project with quotes: the example-data reset must delete quotes of example projects first.

## Acceptance
- `pnpm check`, `pnpm typecheck` pass; seeding the test copy twice is idempotent.
## Out of scope
Live data.
