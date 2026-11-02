---
model: sonnet
effort: high
why: one shared helper reused on lists
depends: [05, 14, 22, 23]
---
# 30 CSV export
## Goal
Customers, MOF register, stock and leftover lists have a Download CSV button that exports what the filters show.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `CSV`, `Copy list`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/lib/format/csv.ts (+ test)
- src/components/app/download-csv-button.tsx
- list pages (customers, mofs, stock, leftover)
## Steps
1. `csv.ts`: RFC 4180 quoting, UTF-8 BOM for Excel, money as plain numbers.
2. Button builds the file client-side from rows already loaded; respects role (no cost column for non-managers).
## Acceptance
- Test: quoting commas, quotes, newlines, BOM.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Excel files.
