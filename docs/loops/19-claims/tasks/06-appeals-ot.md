---
model: sonnet
effort: high
why: Moves existing UI between pages
depends: [04]
---
# 06 Appeals tab move + OT fold-in
## Goal
Per D7 move the Appeals tab from Commission into Claims (Commission keeps a link). Per D3 drop `/overtime` from the
nav and page registry entry for direct use; open its form from Claims section C; keep its actions and tables.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Existing OT and appeal tests still pass. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px.
