---
model: sonnet
effort: high
why: Normal UI + bilingual print
depends: [07]
---
# 08 Samples page + pickup form print
## Goal
Samples table (select, qty at Best Link, who has some out, Take out / Back, client keeps it, paste from Excel); pickup
form sheet and bilingual "V-GQ SIGNATURE RECEIPT" print; Chinese WhatsApp text for Best Link. Demo `vSamples` ~3452.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px. Includes print preview.
