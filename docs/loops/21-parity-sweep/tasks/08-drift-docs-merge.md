---
tier: standard
why: consolidates six reports into docs and owns the PR and merge
depends: [02, 03, 04, 05, 06, 07]
---
# 08 Drift list, docs, merge
## Goal
Docs say which screens passed parity, loop 22 has a ranked drift list to plan from, and the branch is merged.
## Context
Reports in `docs/loops/21-parity-sweep/reports/`. Roadmap: `docs/office-parity/roadmap.md`.
## Files to touch
- `docs/office-parity/drift-after-sweep.md` (rank rows: S first; group by screen)
- `docs/office-parity/drift-money-reports.md`, `drift-new-modules.md`, `drift-site-stock.md`: replace each
  "browser parity after go-live" / "still to run" note with "parity passed 2026-MM-DD (loop 21)" or a pointer to the
  drift-after-sweep rows.
- `docs/office-parity/roadmap.md`: rows 3A, 3B-ii, 4A, 4B-i, 4B-ii say parity done; step 5 Integration → loop 22; add a
  line that loop 22 first takes the S/M rows of `drift-after-sweep.md` if the owner wants them.
- `docs/decisions.md` "Loop 21": D1-D5 summary above the per-screen lines.
## Steps
1. Write the docs above. Check `docs/features.md` only if a fix changed behaviour.
2. Rebase on `main`, full checks, PR (summary: screens checked, fixes made, drift rows by size), merge, clean up per
   AGENTS.md rule 26.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass locally and on the PR; merged to `main`.
- `grep -rn "after go-live" docs/office-parity` returns only lines that point at drift-after-sweep rows.
## Out of scope
Fixing drift-after-sweep rows; planning loop 22.
