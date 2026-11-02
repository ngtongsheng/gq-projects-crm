---
model: opus
effort: medium
why: runs unattended on her Mac every session; idempotency, merge semantics and never breaking her own config are critical
depends: [01]
---
# 03 settings.json + apply.py
## Goal
`gq-setup/agent/settings.json` and `gq-setup/agent/apply.py`: one idempotent script that installs and refreshes the
company layer, run by setup and by the SessionStart hook.
## Context
- Loop decisions D5-D7. Owner's reference: `~/work/config/claude/settings.base.json` (take only model, modelSettings,
  env subagent model, Read deny list, rtk hook, outputStyle; nothing herdr/autoMode/statusline/auto-sync).
- Check current Claude Code docs for settings keys, hook schema and user-level paths before writing
  (`claude-code-guide` agent or https://code.claude.com/docs). Confirm: user output styles dir
  `~/.claude/output-styles/`, user skills dir `~/.claude/skills/`, `@path` imports in `~/.claude/CLAUDE.md`, hook
  command env (no profile loaded: use absolute paths, `$HOME` expansion).
- python3 is `/usr/bin/python3` (Apple CLT, setup step 1). Stdlib only. Honour `HOME` so #05 can test with a scratch HOME.
- rtk hook command via the mise shim path: `$HOME/.local/share/mise/shims/rtk hook claude`; skip the hook entry if
  that file doesn't exist.
## Files to touch
- `gq-setup/agent/settings.json`
- `gq-setup/agent/apply.py`
- `gq-setup/agent/README.md` (5 lines: what apply does, that it runs every session)
## Steps
1. `settings.json`: the D5 keys; SessionStart hook `/usr/bin/python3 "$HOME/GQ/gq-setup/agent/apply.py" --quiet`, short timeout.
2. `apply.py`, each step check-first, all failures caught per step and reported on stderr; exit 0 always under `--quiet`:
   1. Pull: if `~/GQ/gq-setup` is on `main` with empty `git status --porcelain`, `git pull --ff-only -q` (timeout 10s).
   2. Import: ensure `~/.claude/CLAUDE.md` exists and contains the line `@~/GQ/gq-setup/agent/CLAUDE.md` exactly once,
      first line; everything else untouched.
   3. Links: `~/.claude/output-styles/plain.md` and `~/.claude/skills/<name>` → symlinks into `agent/`. Existing
      correct link → skip; existing non-link file or dir → leave it, print a warning, continue.
   4. Settings: merge `agent/settings.json` into `~/.claude/settings.json`. Company keys win for the keys it ships;
      her other keys stay; list values (`permissions.deny`, hooks) are unioned without duplicates. Write atomically;
      invalid existing JSON → leave it, warn.
   5. Remove symlinks in `~/.claude/skills/` that point into `agent/skills/` but whose target no longer exists.
3. Run it against a scratch HOME twice; second run changes nothing (compare file hashes).
## Acceptance
- `HOME=<scratch> /usr/bin/python3 agent/apply.py` twice → identical tree hashes after run 1 and run 2.
- Pre-seeded scratch `~/.claude/CLAUDE.md` text and an extra settings key survive.
- `python3 -m json.tool agent/settings.json` passes.
- Commit in gq-setup (`feat: add company settings and apply script`), push.
## Out of scope
SETUP.md wording (#04); the full dry run (#05).
