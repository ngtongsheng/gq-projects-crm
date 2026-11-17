---
tier: standard
why: event view with grouped costs, budget maths and a print layout
depends: [10]
---
# 13 Events: costs, budget vs actual, print
## Goal
Events view per spec: create an event first, add costs, see budget vs actual, cost groups, and print/PDF.
## Context
Read `00-shared-context.md`. Spec `demo-changes.md` §2.5. Event cost = event cost lines + expense-log lines tagged to
the event.
## Files to touch
`src/app/(app)/marketing/` events data + pure totals module + test, view, event dialog, cost dialog, print.
## Acceptance
- Tests: event total combines both sources; over-budget flag; group summary %.
- `pnpm check && pnpm typecheck && pnpm test` pass; parity (support).
## Out of scope
Excel (15).
