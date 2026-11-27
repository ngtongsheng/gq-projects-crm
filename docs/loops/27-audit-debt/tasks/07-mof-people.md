---
tier: standard
why: three joins that may differ in edge cases (missing B, ordering); the helper must reproduce each exactly
depends: []
---
# 07 mofPeople helper for the "A + B" salesperson join (B4)
## Goal
One tested function builds the "A + B" salesperson label for an MOF, used in the three places that build it now.
## Context
Read `00-shared-context.md`. Audit row B4 (join part): `mofs/mof-data.ts:96-103`,
`mofs/summary/summary-data.ts:138-145`, `collection/page.tsx:101-104`. Compare the three before writing; if they
differ (separator, missing B, null handling), keep each page's current output and record the difference in the report.
## Files to touch
- new `src/app/(app)/mofs/mof-people.ts` and `src/app/(app)/mofs/mof-people.test.ts`
- `src/app/(app)/mofs/mof-data.ts`, `src/app/(app)/mofs/summary/summary-data.ts`, `src/app/(app)/collection/page.tsx`
## Steps
1. Write `mofPeople` (a domain name for it is fine) with tests for: A only, A + B, missing names.
2. Replace the three joins.
## Acceptance
- `pnpm test src/app/\(app\)/mofs/mof-people.test.ts` passes.
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
## Out of scope
Column cells (task 08).
