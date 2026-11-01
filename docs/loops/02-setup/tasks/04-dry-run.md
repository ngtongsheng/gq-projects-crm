---
model: sonnet
effort: high
why: run, observe, and fix instructions across two docs; judgment on what broke
depends: [02, 03]
---
# 04 Dry run on owner's Mac + fixes
## Goal
SETUP.md proven on the owner's account: idempotent skips work, clone/install/hand-off work, and a Desktop run by the owner completes.
## Context
- D6: owner's own account, tools already installed, so this tests skip paths, not fresh installs (#06 does that).
- `gq-setup/SETUP.md`, `gq-setup/README.md`.
## Files to touch
`gq-setup/SETUP.md`, `gq-setup/README.md` (fixes only); loop.md log.
## Steps
1. Executor walk-through: for each SETUP.md step, run its check command; confirm each reports "already done" correctly on this machine. Clone path: use a scratch target (`~/GQ-dryrun/gq-projects-crm`) by substituting the path; `pnpm install` and `pnpm typecheck` pass there.
2. Park `blocked: owner — in Claude Desktop, choose an empty folder ~/GQ-dryrun, paste the README message, follow it to the hand-off`. Owner reports anything confusing or broken.
3. Fix issues in SETUP.md/README.md; push. Log each fix.
4. Clean up `~/GQ-dryrun` after the owner confirms.
## Acceptance
Owner's Desktop run reaches step 9 hand-off and the preview shows the app; `~/GQ-dryrun` removed; fixes pushed to `gq-setup` main.
## Out of scope
Fresh-machine behaviour (Xcode popup, mise first install): #06.
