---
model: sonnet
effort: high
why: Print layout reuse plus option compare and TSV export
depends: [05]
---
# 08 Client quote preview
## Goal
Client quote preview, single option or option compare; Print (Save as PDF) via the shared A4 layout; Copy as TSV.
## Context
- Demo GQC preview screen. `src/components/app/print-layout.tsx` (loop 11 D4). Client view never shows cost or margin.
## Files to touch
- `src/app/(app)/costing/[id]/preview/page.tsx` (new)
- `src/app/(app)/costing/quote-tsv.ts` (new, pure) + test
## Acceptance
- Checks pass; TSV test (columns, totals, no cost). Print preview in Chrome matches the demo's A4 layout.
## Out of scope
Server PDF.
