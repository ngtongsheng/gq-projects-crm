---
model: sonnet
effort: medium
why: Translation pass over finished screens; needs care with the demo's ZHEN map, low logic
depends: [04, 05, 06, 07, 08]
---
# 10 Chinese strings for Costing
## Goal
Every Costing string goes through `t()`; Chinese entries added to `src/lib/i18n/zh.ts` from the demo (GQC app text,
`ZHEN` ~1913 for the English pairs). Noto Sans SC renders when language is `zh`.
## Files to touch
- `src/lib/i18n/zh.ts`, the Costing components from tasks 04-08
## Acceptance
- Checks pass; screenshots of Register and Quote record in 中文 match the demo's Chinese view.
## Out of scope
BM.
