---
model: sonnet
effort: high
why: end-to-end verification across roles
depends: [33, 34]
---
# 35 Walk-through per role on a preview link
## Goal
Every job role's main path works on a preview link with example data, and Vicky has a checklist for her review.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- docs/loops/03-crm-features/assets/walkthrough.md (results)
- docs/debt.md
- fixes as needed (each in its own small PR)
## Steps
1. Create one test person per job role on the test copy (via People on a preview link); run each role's path from `assets/prototype-spec.md` (Nav per job role). Use Claude in Chrome if available; otherwise record as an owner action.
2. Write `walkthrough.md`: per role, pass/fail and notes; plus a plain-language checklist for Vicky's review.
3. Remove the test people afterwards.
## Acceptance
- All roles pass or have a logged fix/debt entry.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Vicky's review itself (owner action).
