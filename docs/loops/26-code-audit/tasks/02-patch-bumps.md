---
tier: standard
why: routine upgrades, but must prove nothing broke
depends: [01]
---
# 02 Patch/minor bumps and minimatch advisory
## Goal
All in-range patch/minor updates applied and the moderate advisory gone, with checks green.
## Context
Read `00-shared-context.md`. At planning: react/react-dom 19.3.0 to 19.3.1 (pinned exact, keep exact),
@supabase/supabase-js 2.119.x, lucide-react 1.81, cn, sonner, tailwindcss/@tailwindcss/turbopack 4.3.5, shadcn
4.23.1, vitest 5.1.2, @types/react 19.3.3, @types/node latest 24.x. Advisory GHSA-g3hv-75wg-m249 via
`shadcn > ts-morph > @ts-morph/common > minimatch`.
## Files to touch
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` only if an override is needed.
## Steps
1. `pnpm outdated`, then `pnpm update` within ranges; bump exact pins (react, react-dom, next if a patch exists) by hand.
2. If `pnpm audit` still reports minimatch: newer shadcn first; otherwise a `pnpm.overrides` / workspace
   override for `minimatch` to the patched version, scoped to that path.
3. Run all checks. If one package breaks, pin it back and log it in the report as a debt item later.
## Acceptance
`pnpm audit` → no vulnerabilities. `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
`pnpm outdated` lists only biome, pglite, supabase, typescript, @types/node 26.
## Out of scope
Majors (tasks 03, 04). TypeScript.
