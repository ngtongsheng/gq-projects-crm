---
tier: economy
why: deletions and a one-line dependency move; the build check catches mistakes
depends: []
---
# 05 Cleanup: dead skeleton, dead export, `shadcn` dependency
## Goal
Three pieces of dead or misplaced code are gone; the app still builds.
## Context
Audit B3, Q3, Q4, each verified:
- `SidebarMenuSkeleton` in `src/components/ui/sidebar.tsx` (~line 581, uses `Math.random` in `useState`) is unused outside
  that file. Remove the component and its entry in the file's export list.
- `effectiveSalesTarget` (and its `EffectiveSalesTarget` type if nothing else uses it) in `src/lib/domain/sales-target.ts`
  has no production caller; only `sales-target.test.ts` uses it. Delete the function, its type if unused, and the test
  file if it only covers this function. Keep any other export in the module.
- `shadcn` is in `package.json` `dependencies` but only imported by `src/app/globals.css` (`@import "shadcn/tailwind.css"`),
  a build-time use. Move it to `devDependencies` with `pnpm`. Do NOT touch the `cn` package: UI files import it directly.
- Do NOT remove `sqftToM2`, `landedPerM2`, `lineAreaM2` or `totalAreaM2`: they have production callers.
## Files to touch
- `src/components/ui/sidebar.tsx`
- `src/lib/domain/sales-target.ts`, `src/lib/domain/sales-target.test.ts`
- `package.json`, `pnpm-lock.yaml`
## Steps
1. Make the three changes. Move `shadcn` by editing `package.json` then `pnpm install` to refresh the lockfile.
## Acceptance
- `grep -rn "SidebarMenuSkeleton\|effectiveSalesTarget" src` returns nothing.
- `pnpm build`, `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Any other dead-code hunt, `cn`, Biome config.
