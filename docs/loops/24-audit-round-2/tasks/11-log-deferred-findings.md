---
tier: economy
why: writing given content into docs
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10]
---
# 11 Log deferred findings in debt.md and the audit
## Goal
Every round-2 finding not fixed in loop 24 has a `docs/debt.md` entry; the audit notes what loop 24 fixed.
## Context
Read `00-shared-context.md` and `docs/loops/24-audit-round-2/loop.md` (Decisions, Log). Match the existing debt.md
format (## heading, What / Why / When to fix).
Deferred: S2, S5, S6, S-DB4, S-DB5 (by design, note only), D3, D5, D8, D9 (fold into existing "Commission rules are
written twice" entry), O2, O4 remainder (~150 `console.error` calls adopt `logServerError` when touched), O8, O9,
O10, X1, X2. Group lows sensibly; at most 8 new entries.
## Files to touch
`docs/debt.md`, `docs/audits/2026-11-16-code-audit-round-2.md` (append "## Loop 24 outcome": fixed IDs, deferred IDs).
## Acceptance
Every audit ID appears either in the outcome's fixed list or in debt.md. `pnpm check` passes.
## Out of scope
Code changes.
