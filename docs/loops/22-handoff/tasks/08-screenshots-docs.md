---
tier: standard
why: browser capture across modules plus doc rewrite; needs judgment on what to show
depends: [05]
---
# 08 Screenshots, README and docs
## Goal
README and `docs/features.md` describe and show the current app (all areas after parity), with fresh screenshots.
## Context
- Loop D10. Current README embeds `docs/screenshots/demo.gif` and `.jpg`s from loop 08 (old CRM). Page list:
  `src/lib/auth/pages.ts`.
- Capture on `pnpm dev` against the dev database with example data (`pnpm catch-up` first), Chrome "Agent" via Claude
  in Chrome, 1280 px, signed in through the Sign in as panel as the role that shows each page best (Vicky for most).
- Fake data only; still check no real email or phone appears. JPG, reasonable size (< 300 KB each); remove
  screenshots no longer referenced anywhere (`grep -r` first).
- Keep README audience: someone opening the repo (what it is, areas, how a change ships, links to docs). Agent-facing
  detail stays in CLAUDE.md / docs.
## Files to touch
- `README.md`, `docs/features.md`, `docs/screenshots/*` (≤ ~12 new shots, one per area + dashboard + sign-in)
## Steps
1. List areas from the page registry; pick one screen each.
2. Capture, save, update both docs; drop the old gif if obsolete.
## Acceptance
- Every image path in README and features.md exists (`grep -o 'docs/screenshots/[^)]*'` then `ls`).
- No unreferenced files left in `docs/screenshots/`. `pnpm check` passes.
## Out of scope
Loop folders' own report screenshots.
