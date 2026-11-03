---
model: sonnet
effort: high
why: small edit, but SETUP.md is live on push and must stay idempotent and jargon-free
depends: []
---
# 01 SETUP.md preflight step

## Goal
Setup stops in the first minute, with a plain message, when her Mac can't finish it: macOS too old for Node 24, or
her account isn't an admin (Apple tools need one). Covers break points B4 and B5.

## Context
- Repo: `~/work/projects/gq-setup` (public; raw `main` is what Vicky's Claude fetches, so a push is live at once).
- Read `SETUP.md` fully first: style rules ("How to talk to her"), check-first pattern, step numbering
  ("Step N of 14"), and "When a step fails twice".
- Break points: `docs/loops/06-setup-rehearsal/assets/break-points.md` (CRM repo) B4, B5.
- Node 24 minimum macOS: look it up (nodejs.org Node 24 release notes or `BUILDING.md` supported platforms for
  v24.x). Do not guess; cite the source in the commit body.

## Files to touch
- `~/work/projects/gq-setup/SETUP.md`
- `~/work/projects/gq-setup/README.md` only if the time estimate or steps change

## Steps
1. Add a step right after "0. Greet", before Apple tools, without renumbering the rest: name it
   "0b. Check this Mac" (keeps "of 14" counts and every doc reference to step numbers valid).
2. Checks (read-only, no popups): `sw_vers -productVersion` compared to the Node 24 minimum; `id -Gn` contains
   `admin`. Both pass → one status line, continue.
3. macOS too old → plain message: the Mac needs a system update before the CRM tools fit; tell Tong Sheng; stop.
   Not admin → plain message: this Mac account can't install Apple's tools; ask whoever manages the Mac, or Tong
   Sheng; stop. Neither message uses the banned words list in SETUP.md.
4. Commit (`feat: check the Mac can run the CRM before setup`), push to `main`.

## Acceptance
- `grep -n "0b" SETUP.md` shows the new step; no other step number changed (`git diff` shows only additions there).
- Banned-word check passes: `grep -niE "terminal|command|shell|PATH|install script|repository|clone|credential|CLI" SETUP.md`
  hits only inside backticked commands or the existing banned-words line, never in a quoted sentence to her.
- On the owner's Mac both checks pass when run by hand.
- `curl -s https://raw.githubusercontent.com/ngtongsheng/gq-setup/main/SETUP.md | grep -c "0b"` ≥ 1 after push.

## Out of scope
Any other SETUP.md change (that is #04, from rehearsal evidence).
