---
model: sonnet
effort: high
why: Formula logic with tests plus simple UI
depends: []
---
# 08 Tools: calculators
## Goal
`/tools`: wallpaper calculator (European 0.53 x 10.06 m, Korean 1.06 x 15.5 m, Fabric Back 1.37 m by running metre;
panels = ceil(width / roll width) x (height + allowance), then rolls) and vinyl sheet calculator (L x W + skirting,
roll width and length, layouts A/B by offcut). Match demo `vTools` ~4105 numbers exactly.
## Files to touch
- `src/lib/domain/wallpaper-calc.ts`, `src/lib/domain/vinyl-calc.ts` (+ tests), tools page components
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: same results as the demo for 3 sample inputs each.
  Parity check, desktop + 390px.
