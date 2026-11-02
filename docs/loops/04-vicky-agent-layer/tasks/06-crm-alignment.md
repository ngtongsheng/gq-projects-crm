---
model: sonnet
effort: high
why: touches CRM rules, CI and docs together; must keep the CRM working for editors without the global layer
depends: [01, 02]
---
# 06 CRM alignment
## Goal
The CRM repo matches the company layer: same plain style (checked in CI), CRM-only style lines in `CLAUDE.md`,
get-help served globally, decisions recorded.
## Context
- Loop decisions D3, D4, D6, D9. Work on branch `loop/04-vicky-agent-layer` in a worktree; merge via PR (direct push
  to main is denied by project settings), checks must pass.
- CRM-only lines removed from the style are listed in the #01 log line in `loop.md`.
## Files to touch
- `.claude/output-styles/plain.md` (byte copy of `gq-setup/agent/output-styles/plain.md`)
- `CLAUDE.md` (add the CRM-only style lines under "A change, start to finish" or a short "Talking about changes" line)
- `.github/workflows/checks.yml` (step: `curl -fsSL https://raw.githubusercontent.com/ngtongsheng/gq-setup/main/agent/output-styles/plain.md | diff - .claude/output-styles/plain.md`)
- `.claude/skills/get-help/` (delete; CLAUDE.md references still resolve via the global skill)
- `docs/decisions.md`, `docs/onboarding.md`, `docs/loops/02-setup/loop.md` (log line: #06 waits for loop 04 and has the new owner checks)
## Steps
1. Copy the style; move CRM-only lines into `CLAUDE.md`.
2. Add the CI drift step.
3. Delete CRM get-help; note in `docs/onboarding.md` that get-help and the company layer come from gq-setup.
4. `docs/decisions.md`: one entry for loop 04 (company layer in public gq-setup, apply on SessionStart and its push =
   code-on-her-Mac risk, opus default on Pro accepted, get-help global).
5. `pnpm check`, `pnpm typecheck`, `pnpm test`; PR, merge when checks pass.
## Acceptance
- `diff .claude/output-styles/plain.md ~/work/projects/gq-setup/agent/output-styles/plain.md` → no output.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green including the drift step; merged.
## Out of scope
gq-setup edits; Desktop testing.
