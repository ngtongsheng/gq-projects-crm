---
tier: standard
why: running balance and alert logic plus a simple register
depends: [12]
---
# 14 Prepaid accounts and sample give-away
## Goal
Prepaid accounts per vendor with balance, low-balance alert, statement and print; the Sample give-away register;
dashboard low-balance banners wired.
## Context
Read `00-shared-context.md`. Decision D8 (statement by date, then entry). Spec `demo-changes.md` §2.6, §2.7, §2.2
banners.
## Files to touch
`src/app/(app)/marketing/` prepaid data + balance module + test, prepaid view, entry dialog, alert dialog, print;
give-away view + dialog + actions; dashboard banner hook-up.
## Acceptance
- Tests: balance and running balance by date; low when alert > 0 and balance < alert; deduction needs client-project.
- `pnpm check && pnpm typecheck && pnpm test` pass; parity (support, accounts).
## Out of scope
Linking give-away to Custom samples (demo keeps them separate).
