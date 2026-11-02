---
model: sonnet
effort: high
why: browser-driven verification vs. the prototype across roles; judgment on gaps
depends: [10]
---
# 11 Smoke test vs prototype: operations side + summary
## Goal
Each module below works on localhost for every role that uses it and matches the prototype, or the gap is fixed.
## Context
- Method (required): `docs/loops/05-audit-smoke/assets/smoke-method.md`. Fix rules: `assets/audit-checklist.md` "Fixing".
- Loop 03 walk-through results: `docs/loops/03-crm-features/assets/walkthrough.md` (don't redo passing basics; go deeper on flows and prototype fit).
- Modules: Installer POs + claims, Delivery & Installation jobs + DOs, Installation Calendar, Site supervisor booking, Site Work (stage, site log, follow-ups), Overtime claims + approval, Leftover/stock returns, Stock items + reservations. Site role at 390px.
## Files to touch
- docs/loops/05-audit-smoke/smoke-results.md, docs/loops/05-audit-smoke/findings.md, docs/debt.md, fixes as needed
## Steps
1. Start `pnpm dev`, open Chrome, sign in per role (method doc).
2. Per module: run the method checklist; write results; fix gaps; re-check.
3. Finish: add a short summary at the top of `findings.md` (counts by status, open D4 items, new debt rows) for the loop PR description.
## Acceptance
- `smoke-results.md` has a row per module listed above with roles tried and pass/fail; every fail has a findings row with a final status.
- `pnpm check && pnpm typecheck && pnpm test` pass after fixes.
- Browser tab closed, `pnpm dev` stopped.
## Out of scope
Admin-only server features (D8). Live app. Visual polish beyond the design system.
