---
model: sonnet
effort: medium
why: Checklist work: parity screenshots, docs, rebase and merge
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10]
---
# 11 Parity pass, docs, merge
## Steps
1. Parity per `docs/office-parity/parity.md` (Chrome profile "Agent") for Tasks and Leave, each role that sees them;
   desktop + 390px.
2. Update `docs/features.md`, `docs/decisions.md` (D2, D3, D4, D7), `docs/office-parity/drift-new-modules.md` (mark
   Tasks and Leave done), `docs/office-parity/roadmap.md` (split 3B per D1: 3B-i Tasks & Leave = 15, 3B-ii HR, Tools &
   People = 16; later loops renumbered).
3. Rebase on `main`; rename migrations older than main's newest (D8). Full checks. PR, merge, clean up.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass locally and on the PR; merged to `main`.
