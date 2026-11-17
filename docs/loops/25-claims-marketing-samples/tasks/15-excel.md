---
tier: standard
why: file parsing with several sheet layouts and date formats at an input boundary
depends: [11, 12, 13, 14]
---
# 15 Excel import and export
## Goal
"Import Excel" and "Download Excel" on the Marketing expense page, as the demo describes, using `exceljs`.
## Context
Read `00-shared-context.md`. Decision D4. Spec `demo-changes.md` §2.8 (sheet detection by header, columns, date
formats, replace vs add, export sheets and file name). Read exceljs README/types in node_modules first. Parse on the
server action; validate rows with zod; report counts and row errors plainly. Export also includes event budget/venue
and categories so a round trip loses nothing the demo would keep (log it).
## Files to touch
`src/app/(app)/marketing/` excel import module + test, export module + test, import dialog, actions.
## Acceptance
- Tests with a small generated workbook: each sheet kind detected; dd/mm/yyyy, ISO and Excel serial dates; "Total"
  rows skipped; replace mode; export -> import round trip equal.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
Vendors sheet import (demo ignores it).
