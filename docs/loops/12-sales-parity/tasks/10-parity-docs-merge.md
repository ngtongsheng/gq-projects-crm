---
model: sonnet
effort: medium
why: Checklist work: parity screenshots, docs, rebase and merge
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09]
---
# 10 Parity pass, docs, merge
## Goal
Every changed screen passes `docs/office-parity/parity.md` for each role that sees it; docs updated; merged.
## Steps
1. Parity per `parity.md` (Chrome profile "Agent") for Customers, company sheet, Calendar (3 tabs), Projects.
2. Update `docs/features.md`, `docs/decisions.md` (D1, D3, deviations), `docs/office-parity/drift-shell-sales.md`
   (mark done items), roadmap row 2A.
3. Rebase on `main`; apply D5 (rename migrations older than main's newest). Full checks. PR, merge, clean up.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass locally and on the PR; merged to `main`.
