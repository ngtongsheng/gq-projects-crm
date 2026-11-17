---
tier: standard
why: list plus one sheet with three actions over a schema that enforces the rules
depends: [03]
---
# 04 All claims list and check/release sheet
## Goal
MD and Jany see every claimant's claim for a month, open a submitted one, set final amount, note and Vicky tick,
Return it or Release it once the report is in.
## Context
Read `00-shared-context.md`. Decision D3. Spec `demo-changes.md` §1.3 (columns, "N ready to release", blank rows for
people with no claim), §1.4 (sheet, Return, Save, Release with soft Vicky warning: first tap shows "Not yet verified
with Vicky. Tap Release again to release anyway."), §1.1 (managers who also claim get "All claims"/"My claim").
## Files to touch
New `src/app/(app)/claims/` files for the list, sheet and review actions (+ test); `page.tsx`; i18n.
## Steps
1. Data: active eligible people x month, joined with claims and report status.
2. Review actions: save, return, release; database errors mapped to plain messages.
3. Sheet with print button (reuse 03's print).
## Acceptance
- Action tests: only md/accounts; release blocked without report; released claim is read-only.
- `pnpm check && pnpm typecheck && pnpm test` pass; in `pnpm dev` Jany releases a claim.
- Parity (md, accounts).
## Out of scope
Dashboard reminder (16).
