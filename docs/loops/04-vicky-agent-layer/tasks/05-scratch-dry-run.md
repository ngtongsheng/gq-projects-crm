---
model: sonnet
effort: high
why: verification across several files with fixes; must not touch the owner's real ~/.claude
depends: [02, 04]
---
# 05 Scratch-HOME dry run + fixes
## Goal
Evidence that the new setup steps and `apply.py` work, are idempotent and keep existing config, without touching the
owner's real home.
## Context
- Loop decisions D6, D7, D9, D13. Never run anything against the real `~/.claude` or `~/GQ`.
- Scratch HOME under the session scratchpad. Clone gq-setup into `<scratch>/GQ/gq-setup` from the local repo
  (`git clone ~/work/projects/gq-setup`), then point its origin at GitHub so pull works.
## Files to touch
Fixes only, in `gq-setup/agent/apply.py`, `gq-setup/agent/settings.json`, `gq-setup/SETUP.md`.
## Steps
1. Empty HOME: run the new SETUP.md steps' commands (rtk skipped: mise is real) and `apply.py` twice; hash the tree
   after each run.
2. Seeded HOME: `~/.claude/CLAUDE.md` with own text + `## About me`, `settings.json` with an extra key and own deny
   entry, a real (non-link) `~/.claude/skills/tdd/` dir. Run twice.
3. Dirty / branch case: uncommitted change in `<scratch>/GQ/gq-setup` → pull skipped, apply still exits 0 with `--quiet`.
4. Secrets grep (D9) over gq-setup: `grep -rniE "sk-|secret|password=|token=|supabase\.co|service_role" .` → nothing real.
5. Fix what fails, rerun, commit fixes (`fix: ...`), push.
## Acceptance
- Run 1 and run 2 hashes identical in both HOMEs.
- Seeded text, `## About me`, extra key, own deny entry and the real `tdd` dir survive; warning printed for `tdd`.
- Hook command in the merged settings resolves under the scratch HOME.
- Log line in loop.md with results and anything left for loop 02 #06 to confirm in Desktop.
## Out of scope
Desktop behaviour (loop 02 #06).
