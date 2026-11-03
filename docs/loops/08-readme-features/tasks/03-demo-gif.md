---
model: sonnet
effort: medium
why: browser recording with timing and file handling
depends: [01]
---
# 03 README demo GIF
## Goal
`docs/screenshots/demo.gif` shown at the top of README (D5).
## Context
- `gif_creator`: `start_recording`, take a screenshot right after; do the clicks; screenshot right before `stop_recording`;
  `export` with `download: true`, `filename: "demo.gif"`, options all overlays false, `showWatermark: false`, quality ~15.
  File lands in `~/Downloads/`.
- Sign in as director (`.env.smoke.local`) before recording, so no typed password is in the clip.
## Files to touch
- docs/screenshots/demo.gif, README.md
## Steps
1. `pnpm dev`; tab at 1440x900; sign in; go to sign-in-complete Dashboard.
2. Record: Dashboard, Customers (open one), MOF Register (open one), Sales Calendar. ~15-20 s, pause ~1-2 s per screen.
3. Export, `mv ~/Downloads/demo.gif docs/screenshots/demo.gif`.
4. Replace the README placeholder with `![GQ Projects CRM demo](docs/screenshots/demo.gif)`.
5. Close tab, stop `pnpm dev`.
## Acceptance
- `ls -lh docs/screenshots/demo.gif` under ~10 MB; opens and animates.
- README renders the image path that exists. `pnpm check` passes.
## Out of scope
mp4/video hosting.
