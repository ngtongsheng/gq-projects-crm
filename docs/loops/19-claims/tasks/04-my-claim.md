---
model: sonnet
effort: high
why: Normal UI with receipt upload
depends: [02, 03]
---
# 04 My claim: sections A-C
## Goal
`/claims` My claim: (A) commission lines with checkboxes and late cut, (B) travelling lines with receipt photos and
flags, (C) OT / replacement leave sum (D3); banners original vs final. Add "My claims" to the site nav. Demo `vClaims` ~4240.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px.
