---
model: opus
effort: medium
why: Rewriting a 15k-char setup script for a non-technical user on a second OS; cannot be tested here
depends: [05]
---
# 13 Windows path in SETUP.md
## Goal
Pasting the setup link on Windows sets up (or repairs) everything the Mac path does (D16). Mac path unchanged.
## Context
gq-setup worktree. `SETUP.md` is followed by Claude Desktop from a raw GitHub URL; steps are safe to re-run, talk in
plain style, use AskUserQuestion. Mac-only today (xcode-select etc.). Her CRM path on Windows:
`C:\Users\vicky\GQ\gq-projects-crm`. Tools needed: Git, GitHub CLI (+ `gh auth login`), mise (Node + pnpm from
`mise.toml`), the agent kit via `node agent/apply.mjs` (task 05). Check current winget package ids before writing.
## Files to touch
`SETUP.md`, `README.md` if it states Mac-only.
## Steps
1. First step detects the OS and branches; shared steps stay shared.
2. Windows: `winget install --id Git.Git`, `GitHub.cli`, `jdx.mise` (verify ids); `git config --global core.autocrlf
   false`; mise activation for PowerShell; clone into `%USERPROFILE%\GQ`; `pnpm install`; run `apply.mjs`.
3. Every step checks first and skips when done; failures map to a plain sentence and get-help.
## Acceptance
- A fresh subagent reads SETUP.md as if on Windows and lists each command it would run; no Mac-only command appears
  on the Windows path and vice versa.
- Real run is an owner action (loop.md).
## Out of scope
Buying/setting up her Mac.
