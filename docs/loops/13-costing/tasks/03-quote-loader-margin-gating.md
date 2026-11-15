---
model: opus
effort: medium
why: Permission-critical shaping: cost and margin must never reach people without the margin flag
depends: [01, 02]
---
# 03 Quote loader + margin gating
## Goal
Server loaders for register and quote record return computed totals (task 01) and strip cost, margin and FOB fields
for people without the margin flag, replacing them with "Low" / "High" margin (D3).
## Context
- Margin flag and access matrix: `src/lib/auth/pages.ts` ("See margin % and cost", `cost` page).
- Page guard pattern: other module pages under `src/app/(app)/` call the registry check server-side.
## Files to touch
- `src/app/(app)/costing/quote-data.ts` (new) + test
- `src/app/(app)/costing/quote-view.ts` (new, pure: full vs restricted shape, Zod-derived types) + test
## Acceptance
- Checks pass; tests: restricted shape has no cost/margin/FOB keys at all; Low/High follows min margin setting.
## Out of scope
Pages.
