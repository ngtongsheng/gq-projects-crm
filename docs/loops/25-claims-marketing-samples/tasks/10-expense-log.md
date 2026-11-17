---
tier: standard
why: one list with filters, one form, one categories editor
depends: [09]
---
# 10 Expense log and categories editor
## Goal
The Marketing expense page exists with its six view tabs (others empty until their task), the Expense log works, and
categories can be added, renamed, reordered and moved.
## Context
Read `00-shared-context.md`. Spec `demo-changes.md` §2 intro, §2.1, §2.3. Accounts sees no add/edit (D5).
## Files to touch
New `src/app/(app)/marketing/` (page, view tabs, expense data, actions + test, expense dialog, categories dialog);
flip `mkt` to built; i18n.
## Acceptance
- Action tests: validation messages of §2.1; RM amount copied for RM currency; accounts refused.
- `pnpm check && pnpm typecheck && pnpm test` pass; parity (support, accounts).
## Out of scope
Other views.
