---
tier: standard
why: reorders awaits in a large page; must keep the role gating of each query
depends: []
---
# 03 MOF detail: parallelise post-load queries
## Goal
`src/app/(app)/mofs/[id]/page.tsx` fetches installer POs, DO lines and delivered-earlier counts in one parallel step
instead of three sequential rounds. Rendered output is identical.
## Context
Audit P4, verified (around lines 224-243): after the main `Promise.all`, the page awaits in order
`loadInstallerPos(supabase, mof.id, nameOf)` (only when `showInstallers`), `loadMofDoLines(supabase, mof.id)`, then a
`Promise.all` of `loadDeliveredEarlier(supabase, mof.id, job.id)` per delivery job (only when `canSchedule`). Each needs
only values already resolved by then (`mof.id`, `nameOf`, `jobs`).
## Files to touch
- `src/app/(app)/mofs/[id]/page.tsx`
## Steps
1. Read the page from the main `Promise.all` to the first `return`.
2. Start the three queries together in one `Promise.all`, keeping the `showInstallers` and `canSchedule` conditions so
   a role that cannot see a section still triggers no query for it.
3. Keep the `earlierByJob` map shape.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- Diff is limited to that block; no change to props passed to child components.
## Out of scope
Folding these into the first `Promise.all`, changing the loaders, other MOF pages.
