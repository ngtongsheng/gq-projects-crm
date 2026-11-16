---
tier: standard
why: test design needs judgment about what counts as a gap across split per-feature dictionaries
depends: []
---
# 06 zh/bm key-parity test
## Goal
A test fails when an English phrase is translated in Chinese but not Malay, or the other way round, so a missing pair
no longer slips through silently. Today's existing gaps are recorded so the test passes now and catches new ones.
## Context
Audit R6, verified: `src/lib/i18n/t.ts` looks the English text up in the `zh` and `bm` dictionaries and silently falls
back to English. The dictionaries are split across files re-exported through `zh.ts` and `bm.ts` (`zh-claims.ts`,
`zh-hr-tools.ts`, `zh-installation-stock.ts`, `zh-tasks-leave.ts`, `bm-claims.ts`, `bm-installation.ts`,
`bm-site-work.ts`). `t.test.ts` has no parity check. Decision D6: snapshot allowlist, no new translations.
## Files to touch
- `src/lib/i18n/key-parity.test.ts` (new)
## Steps
1. Import `zh` and `bm`. Compute keys in `zh` missing from `bm` and keys in `bm` missing from `zh`.
2. Assert both lists equal an explicit in-file allowlist (`KNOWN_MISSING_IN_BM`, `KNOWN_MISSING_IN_ZH`) holding today's
   gaps, so the test names any new or newly fixed gap. If there are no gaps, assert empty lists.
3. If either list exceeds 40 keys, keep the allowlist but add a debt entry in `docs/debt.md`: what (translation gap
   count), why (needs a native-speaker pass), when to fix (next i18n sweep, audit Q1).
## Acceptance
- `pnpm test src/lib/i18n` passes; temporarily deleting one key from `bm` makes the new test fail (revert after).
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Adding translations, the Q1 raw-English sweep, changing `t()`.
