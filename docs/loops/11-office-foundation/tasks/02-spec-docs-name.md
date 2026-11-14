---
model: sonnet
effort: medium
why: Mostly mechanical, but the parity procedure must be precise enough for every later loop to follow
depends: []
---
# 02 Demo into repo, logo, app name, parity and handover docs
## Goal
The demo is the spec in the repo, the app is called "GQP Office" with the demo's logo, and two docs exist: the parity
procedure and the handover migration list.
## Context
- Demo source: `/Users/tongshengng/Downloads/GQP-Office-demo.html` (Vicky, 2026-11-14; also published at
  https://claude.ai/artifact/Qtdnc1FZ49ZMBUfF2iHtAe). Old spec: `docs/mockup/gq-crm-mockup.html`.
- The logo is a base64 PNG inside the header (`<div class="brand"><img src="data:image/png;base64,...`, around line
  426). The favicon stays unless the demo has its own.
- Parity method (D9), agreed with the owner: per screen and role, at 1280 px and 390 px wide:
  1. Structure diff: one JS snippet run in both pages via the Chrome javascript tool returns an outline (sidebar items
     in order, page heading, tile labels, filter controls, tab labels, table column headers in order, button labels).
     Any difference fails, unless logged as a deviation in `docs/decisions.md`.
  2. Screenshots side by side for spacing, grouping and colour.
  In the demo, pick the person in "Signed in as"; in the app (`pnpm dev`), use the dev role panel to sign in as the same
  person (task 14 seeds them). Demo data is example data in localStorage; "Reset example data" restores it.
## Files to touch
- `docs/mockup/gqp-office-demo.html` is already in the repo (committed with this plan); delete `docs/mockup/gq-crm-mockup.html`, update references
  to it (`grep -rn gq-crm-mockup docs src CLAUDE.md README.md`)
- `public/gqp-office-logo.png` (decoded from the base64)
- `src/lib/app-name.ts` (+ its test): "GQP Office"
- `docs/office-parity/parity.md` (new): the procedure above, the outline snippet itself (one snippet that works on both
  pages: it reads the demo's `#tabs .nav-i .lbl`, `h1.page`, `.tile .k`, `th`, `button` and the app's equivalents
  through a small selector map), and a checklist.
- `docs/handover-migration.md` (new): one row per account-bound item (Vercel project + env vars, Supabase dev and prod
  projects, GitHub secrets, GCP OAuth client, storage buckets, health workflow), with what moves and the steps. Later
  tasks add their rows.
## Steps
1. Decode the logo (`base64 -d`), rename the app.
2. Write `parity.md`; prove the snippet by running it on the demo's Dashboard as Vicky and on the app's Dashboard,
   and paste both outputs as the worked example.
3. Write `handover-migration.md`.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- `grep -rn "gq-crm-mockup" docs src CLAUDE.md README.md` finds nothing outside `docs/loops/`.
- `parity.md` contains the snippet and a worked example from a real run.
## Out of scope
Changing the shell (task 07).
