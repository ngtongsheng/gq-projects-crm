---
tier: standard
why: four DataTable column sets with small variations; a factory must keep each page's columns identical
depends: [07]
---
# 08 MOF register column factory (B4)
## Goal
The "MOF no." link column and the "Company / project" cell come from one `mofs/mof-columns.tsx`, used by the four
register pages. Each page shows the same columns, links, sorting and text as now.
## Context
Read `00-shared-context.md` and `docs/design-system.md` (`DataTable`). Audit row B4 (columns):
`collection/page.tsx:74-99`, `mofs/page.tsx:165-202`, `mofs/summary/page.tsx:156-185`, `commission/page.tsx:150-170`.
Only the two shared columns move; page-specific columns stay on their pages.
## Files to touch
- new `src/app/(app)/mofs/mof-columns.tsx`
- `src/app/(app)/collection/page.tsx`, `src/app/(app)/mofs/page.tsx`, `src/app/(app)/mofs/summary/page.tsx`,
  `src/app/(app)/commission/page.tsx`
## Steps
1. Diff the four definitions. Write column builders taking the row accessor each page needs.
2. Replace the copies.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
- `pnpm dev`, then open `/collection`, `/mofs`, `/mofs/summary`, `/commission` signed in as admin (or read the
  rendered column config); the two columns look and link as before. If the dev server can't sign in, say so in the report.
## Out of scope
Other columns, page layouts.
