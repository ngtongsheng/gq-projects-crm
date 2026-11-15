---
model: sonnet
effort: medium
why: Checklist work: parity screenshots, docs, rebase and merge
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11]
---
# 12 Parity pass, docs, merge
## Steps
1. Parity per `docs/office-parity/parity.md` (Chrome profile "Agent") for every Costing screen: md, director, sales,
   support, accounts, and a role without margin flag; desktop + 390px.
2. Update `docs/features.md`, `docs/decisions.md` (D1, D3, deviations), drift doc "Costing" (mark done), roadmap row 2B.
3. Rebase on `main`; apply D7 (rename migrations older than main's newest). Full checks. PR, merge, clean up.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass locally and on the PR; merged to `main`.
