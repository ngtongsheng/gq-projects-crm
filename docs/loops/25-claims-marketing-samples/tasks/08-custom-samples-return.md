---
tier: standard
why: three small actions and a settings dialog following set rules
depends: [07]
---
# 08 Custom samples return, give away, overdue remind, settings
## Goal
Two-step return, give away, WhatsApp reminder for overdue loans, and the loan-days setting all work.
## Context
Read `00-shared-context.md`. Spec `demo-changes.md` §3.6 (incl. admin one-step "Received back" and "Not received"),
§3.7, §3.3 WhatsApp text `tfWaText` and number source (Reminders WhatsApp setting: find the existing one).
## Files to touch
`src/app/(app)/custom-samples/` actions (+ test), detail sheet, give-away dialog, settings dialog; i18n.
## Acceptance
- Action tests: borrower marks returned; admin confirms or rejects; give away needs customer and reason; given-away
  sample is locked.
- `pnpm check && pnpm typecheck && pnpm test` pass; parity (sales, designer).
## Out of scope
Dashboard reminders (16).
