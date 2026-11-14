---
model: sonnet
effort: medium
why: Print layout from a given demo form
depends: [04]
---
# 07 Claim print
## Goal
Monthly claim form as demo `printClaim`: sections A-C, Claimed / Checked / Approved signatures, original-vs-final box.
Loop 11 print layout.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check of print preview.
