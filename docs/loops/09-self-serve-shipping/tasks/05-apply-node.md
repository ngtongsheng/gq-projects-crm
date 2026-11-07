---
model: sonnet
effort: high
why: Port of an installer that edits user settings on two OSes; must stay idempotent
depends: []
---
# 05 Port gq-setup apply.py to Node
## Goal
The company kit refresh runs on Windows and Mac with Node only (D9). Behaviour identical to `apply.py`.
## Context
Repo `~/work/projects/gq-setup` (own worktree, branch `loop/09-self-serve-shipping`). `agent/README.md` describes
`apply.py`: pulls gq-setup (clean `main` only), adds `@~/GQ/gq-setup/agent/CLAUDE.md` import to `~/.claude/CLAUDE.md`,
links the `plain` style and skills, merges `agent/settings.json` into `~/.claude/settings.json` (company keys win),
and a SessionStart hook runs it every session. On Windows symlinks need admin or developer mode: copy instead of link
when `fs.symlink` fails, and refresh copies each run.
## Files to touch
New `agent/apply.mjs`, delete `agent/apply.py`, `agent/settings.json` (hook command `node ~/GQ/gq-setup/agent/apply.mjs`
or a path that works on both OSes), `agent/README.md`, `SETUP.md` references to apply.py.
## Steps
1. Read `apply.py`; port 1:1 to `apply.mjs` using `node:fs`, `node:path`, `node:os`, `node:child_process`.
2. Use `os.homedir()` paths; quiet output unless something changed or failed.
3. Hook command must work in both cmd/PowerShell and zsh. Verify the Claude Code hook docs for how commands run on
   Windows before choosing.
4. Remove apply.py and every reference.
## Acceptance
- On this Mac with a temp HOME (`HOME=$(mktemp -d) node agent/apply.mjs`): creates the same files as apply.py did;
  second run changes nothing.
- `grep -rn apply.py ~/work/projects/gq-setup` empty.
## Out of scope
Windows install steps (task 13), help-bundle (task 10).
