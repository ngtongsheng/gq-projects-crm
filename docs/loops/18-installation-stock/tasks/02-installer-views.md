---
model: sonnet
effort: high
why: Normal UI work
depends: [01]
---
# 02 Installer directory + calendar views
## Goal
Installers calendar (filter by installer and supervisor; "DOs not yet signed & returned" panel), Installer contacts
directory (WhatsApp links, job count, last job, active). Demo `vInst` ~3802.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px.
