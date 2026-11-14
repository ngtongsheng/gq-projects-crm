---
model: opus
effort: medium
why: Stock movement log and numbered forms; deductions must stay consistent
depends: []
---
# 07 Samples migration + rules
## Goal
`samples` (product, brand, SKU, name, qty, unit, spec, notes), in/out/adjust log, who has some out, pickup forms
SR-0001 (D4) whose saving deducts stock, settings. RLS per D4. Domain module for balances.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: take out / back / client keeps; pickup deducts; numbering never reuses.
