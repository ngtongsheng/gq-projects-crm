---
model: haiku
effort: low
why: mechanical doc updates and running checks
depends: [02, 03, 04, 05, 06, 07, 08, 09]
---
# 10 Final checks and docs
## Goal
Docs reflect the loop; all checks pass.
## Context
- `docs/debt.md` should no longer have rows for loop 05 findings 3, 14, 20, 31, 45, 49, 55, 59, 64.
## Files to touch
- `docs/decisions.md`: one entry for D1 (salespeople see own projects; owner decision 2026-11-03) and D2 (PGlite tests)
- `docs/debt.md` (remove any leftover row for those findings)
- `docs/loops/05-audit-smoke/findings.md`: set those rows' status to `fixed (loop 07)`
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass; `pnpm guard:migrations` clean.
- `grep -nE "permission rules|MOF is several|payout cap|new company is two|Set-password link|Payment total cap|read every project|forms c|over-held|below what is held" docs/debt.md` prints nothing.
## Out of scope
- Prototype screen debt rows (54, 56-58, 65, 66).
