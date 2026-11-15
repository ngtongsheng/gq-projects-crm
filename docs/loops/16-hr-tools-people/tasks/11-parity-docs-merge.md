---
model: sonnet
effort: medium
why: Checklist work: parity screenshots, docs, rebase and merge
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10]
---
# 11 Parity pass, docs, merge
## Steps
1. Parity per `docs/office-parity/parity.md` (Chrome profile "Agent") for HR, Tools & Forms and People, each role that
   sees them; desktop + 390px.
2. Update `docs/features.md`, `docs/decisions.md` (D1, D3, D5), `docs/office-parity/drift-new-modules.md` (mark done),
   `docs/office-parity/roadmap.md` row 3B-ii.
3. Rebase on `main`; rename migrations older than main's newest (D8). Full checks. PR, merge, clean up.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass locally and on the PR; merged to `main`.
