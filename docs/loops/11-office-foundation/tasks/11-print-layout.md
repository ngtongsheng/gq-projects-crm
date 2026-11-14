---
model: sonnet
effort: medium
why: Small shared component, but every printable form later depends on its A4 behaviour
depends: [07]
---
# 11 A4 print layout
## Goal
One A4 print layout that hides the shell when printing and matches the demo's printed forms.
## Context
- D4. Demo print views: `printClaim`, `printDO`, `printSrep`, the report print, Tools & Forms forms (`vTools` ~4105).
  They open a print view with a title block, tables and signature boxes, then `window.print()`.
## Files to touch
- `src/components/app/print-layout.tsx` (new): page title block with logo, body, signature row helper, Print button
- `src/app/globals.css` (`@media print` rules, `@page { size: A4 }`)
- `/dev/components` entry; `docs/design-system.md` (one line)
## Steps
1. Build the layout from the demo's print markup and CSS (find `@media print` and the print functions).
2. Show a sample on `/dev/components`; print preview in Chrome at A4 shows no sidebar or header.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- A Chrome print preview screenshot of the sample shows one clean A4 page.
## Out of scope
The actual forms (their loops).
