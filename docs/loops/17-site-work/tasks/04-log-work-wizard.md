---
model: sonnet
effort: high
why: Multi-step mobile form; normal feature work
depends: [02]
---
# 04 Log work wizard
## Goal
Steps 1-4 per drift doc: pick MOF or new site; multi-select activities (no Others); per-activity fields; saved +
WhatsApp deep link (D4). Sticky bottom button on phones. Replaces `site-log-dialog.tsx` use where the demo does.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Parity check per role that sees it (`docs/office-parity/parity.md`), desktop + 390px.
