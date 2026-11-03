---
model: opus
effort: medium
why: root-causing Desktop/PATH/background-process issues across two repos from owner notes; judgment on durable fixes
depends: [03]
---
# 04 Fix rehearsal findings

## Goal
Every fail in the rehearsal sheet has a root-cause fix or a logged fallback, and the re-paste repair path still works.

## Context
- Filled sheet: `../assets/rehearsal-sheet.md`. Break points: `../assets/break-points.md`.
- Likely areas: `~/work/projects/gq-setup/SETUP.md` (steps 2, 6, 10, 11), `~/work/projects/gq-setup/agent/apply.py`,
  CRM `.claude/launch.json`, CRM `.claude/skills/preview/SKILL.md`.
- For B1 (preview can't find pnpm): check Claude Desktop docs for launch.json fields
  (https://code.claude.com/docs/en/desktop.md) before changing `runtimeExecutable`; a path must work for any user,
  not hard-code `/Users/<name>`.
- SETUP.md rules: check-first, idempotent, plain words, step numbers unchanged. gq-setup push to `main` is live.
- CRM changes go through a branch + PR per CLAUDE.md; merge only with green checks (`gh pr checks`).
- Two failed attempts on one finding: stop, log what was learned, mark it for the runbook fallback instead.

## Files to touch
≤5 of the files above, as the findings require.

## Steps
1. Per fail: reproduce in the owner's account where possible, find the cause, fix, verify.
2. Push gq-setup; open, check and merge the CRM PR if CRM files changed.
3. Park for owner: re-paste the setup link in the rehearsal user; every step reports "already done" or passes; first
   preview opens.
4. Record each finding → fix (or fallback) as one Log line in `../loop.md`.

## Acceptance
- Owner's re-paste run: all sheet rows pass or have a named fallback.
- CRM changes: `pnpm check && pnpm typecheck && pnpm test` pass; PR merged.
- No fix hard-codes a user's home path.

## Out of scope
New features in setup; anything the sheet didn't show failing.
