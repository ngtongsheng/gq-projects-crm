---
model: sonnet
effort: medium
why: Small UI deltas on an existing page
depends: []
---
# 06 Stock page deltas
## Goal
Segmented Reserved / Leftover / Samples, four tiles, "Paste from sheet" (reuse `stock-import.ts`), "Email suppliers
(N)" with supplier-notice flag (D6).
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px.
