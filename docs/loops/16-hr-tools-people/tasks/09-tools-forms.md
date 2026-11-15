---
model: sonnet
effort: high
why: Print layouts pre-filled from MOF data
depends: []
---
# 09 Tools: A4 forms + links
## Goal
A4 forms, blank or pre-filled from an awarded MOF: site measurement summary, work commencement acknowledgement,
project handover (HO-01), copied from demo ~4181. Best Link sample pickup link; admin-added Drive links list.
## Context
- Loop 11 print layout; awarded MOF data in `mofs`.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check incl. print preview.
