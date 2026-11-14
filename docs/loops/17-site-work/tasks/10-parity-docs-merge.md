---
model: sonnet
effort: medium
why: Checklist work: parity screenshots, docs, rebase and merge
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09]
---
# 10 Parity pass, docs, merge
## Steps
1. Parity per `docs/office-parity/parity.md` (Chrome profile "Agent") for Log work and Site Work, each role that sees them; desktop + 390px.
2. Update `docs/features.md`, `docs/decisions.md` (D2, D5, D6), `docs/office-parity/drift-site-stock.md` (mark Log work, Site Work done), `docs/office-parity/roadmap.md` row 4B-i.
3. Rebase on `main`; rename migrations older than main's newest. Full checks. PR, merge, clean up.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass locally and on the PR; merged to `main`.
