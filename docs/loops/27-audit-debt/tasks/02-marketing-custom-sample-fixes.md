---
tier: standard
why: three small independent fixes; the A10 handler must match the file's existing error UI
depends: []
---
# 02 Marketing page reads in parallel, parse failure logged, photo rejection handled
## Goal
A3: categories load inside the same `Promise.all` as each view's reads. A4: a workbook that fails to parse is logged
before the user sees the same "not an xlsx" message. A10: a failed `openCustomSamplePhoto` call no longer becomes an
unhandled rejection.
## Context
Read `00-shared-context.md`. Audit rows A3, A4, A10.
## Files to touch
- `src/app/(app)/marketing/page.tsx` (around line 55: `loadMarketingCategories()` awaited before the views)
- `src/app/(app)/marketing/marketing-excel-actions.ts` (around lines 69-75: `.catch(() => null)`)
- `src/app/(app)/custom-samples/custom-sample-sheet.tsx` (around lines 199-201)
## Steps
1. A3: start the categories read without awaiting it first, so it runs in parallel with each view's own reads
   (pass the promise down, or start both in one `Promise.all`). The rendered output stays the same.
2. A4: in the catch, call `logServerError` with the error, then return the same `null` as now.
3. A10: add a rejection handler that shows the same plain error this file already shows for a failed action (reuse
   its existing toast or message). If the file has no error UI, log a debt line instead of inventing one and
   leave A10 open.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
- Existing tests for marketing excel actions pass unchanged.
## Out of scope
A12, A13 (sample codes and photo storage).
