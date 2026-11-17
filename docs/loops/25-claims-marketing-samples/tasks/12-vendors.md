---
tier: standard
why: list with YTD totals and one form
depends: [10]
---
# 12 Vendors and part-timers
## Goal
Vendors & part-timers view per spec, with companies auto-added from expense vendors and YTD spend per vendor.
## Context
Read `00-shared-context.md`. Spec `demo-changes.md` §2.4. With FK vendors (09), "auto-added" means the expense form
creates a company vendor when a new name is typed.
## Files to touch
`src/app/(app)/marketing/` vendors data, actions + test, view, dialog; expense dialog vendor picker; i18n.
## Acceptance
- Tests: YTD total and last paid; delete blocked when used by expenses or prepaid entries.
- `pnpm check && pnpm typecheck && pnpm test` pass; parity (marketing).
## Out of scope
Prepaid (14).
