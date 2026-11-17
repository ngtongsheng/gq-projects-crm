---
tier: standard
why: four reminder rules across roles in the existing dashboard reminder list
depends: [04, 08, 14]
---
# 16 Dashboard reminders
## Goal
The dashboard reminders of `demo-changes.md` §B replace the old claim reminders.
## Context
Read `00-shared-context.md`. Find where the old "claim not submitted" and "claims to approve" reminders live (loop
22 integration; grep the dashboard/today code) and replace them. Rules: travel claim not submitted (claimant, within
10 days of cut-off); "N travel claim(s) ready to release" (accounts and md: the demo shows accounts only; add md,
log it); custom sample due within 3 days/overdue (borrower); confirm returns and overdue list (designer, ssup, md);
prepaid low (accounts, md).
## Files to touch
The reminder module(s) + tests; i18n.
## Acceptance
- Tests per rule (dates at cut-off and due-date edges, roles).
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
WhatsApp sending.
