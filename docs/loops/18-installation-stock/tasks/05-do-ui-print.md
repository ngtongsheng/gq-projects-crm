---
model: sonnet
effort: high
why: Normal UI + print layout work
depends: [04]
---
# 05 DO on the job + print + delivery log
## Goal
"Issue DO no. now" on the job, Done blocked without one (D3), DO lines editor, printable A4 DELIVERY ORDER (loop 11
print layout; fields per drift doc), warnings per D3, delivery log on the MOF register (14 columns).
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px. Includes print preview.
