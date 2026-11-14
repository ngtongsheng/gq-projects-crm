---
model: sonnet
effort: medium
why: Verification, docs and merge; judgment on parity results but no new design
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14]
---
# 15 Final checks, shell parity pass, docs, merge
## Goal
Loop 11 is verified, documented and merged to `main`.
## Files to touch
- `docs/decisions.md` (loop 11 decisions D1-D14 in its format, plus any deviations from the demo found in parity)
- `docs/features.md`, `docs/glossary.md` (roles, View as, Google sign-in), `docs/environments.md`,
  `docs/handover-migration.md` (complete), `docs/office-parity/roadmap.md` (step 1 done)
## Steps
1. `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations`, `pnpm build`.
2. Parity pass per `docs/office-parity/parity.md`: shell for md, director, bd, sales, accounts, site (BM), ssup,
   support, designer at 1280 and 390 px; View as banner. Fix differences or log them as deviations.
3. Docs. 4. PR from `loop/11-office-foundation`, wait for PR checks (migrations apply to the test copy), merge, confirm
   `migrate-prod` succeeded.
## Acceptance
- All commands in step 1 pass; PR checks green; PR merged; `migrate-prod` run `success`.
## Out of scope
Any page content beyond the shell.
