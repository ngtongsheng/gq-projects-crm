---
model: sonnet
effort: high
why: Money maths with several item types; formulas are given, tests carry the risk
depends: []
---
# 01 Costing maths
## Goal
Pure functions for every Costing number, matching the demo to the sen.
## Context
- Formulas: `docs/office-parity/drift-new-modules.md` "Costing" Maths bullet. Demo source: GQC app ~436-1450
  (search `landed`, `unitCost`, `margin`). Copy rounding behaviour from the demo; D2 rounds per line to 2 dp.
- Types: local, import, rug (area or per piece), labour, lump, discount; supply-only drops install.
- Margin bands: <20% red, 20-30% amber, >=30% green. Quote amount = highest option sell.
- Existing style: `src/lib/domain/mof-totals.ts` (+ test).
## Files to touch
- `src/lib/domain/costing.ts` (new) + `costing.test.ts`
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: each item type, supply-only, sqft conversion (÷10.764),
  discount (negative sell, zero cost), option totals, band boundaries (19.99/20/30), quote amount; at least one case
  recomputed from a demo seed quote.
## Out of scope
Persistence, UI.
