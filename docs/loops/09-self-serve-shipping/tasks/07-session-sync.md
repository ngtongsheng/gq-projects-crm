---
model: opus
effort: medium
why: Hooks that run unattended on two OSes and inject instructions; security filter and git safety matter
depends: [06]
---
# 07 Session-sync hook and remote instructions
## Goal
Every session (new, resumed, cleared, compacted) and at most every 15 minutes of use, Vicky's agent has the latest
`main` and Tong Sheng's open instructions, and acts on them without her (D14).
## Context
Read loop.md D14. Claude Code hooks: read the current hooks docs (https://code.claude.com/docs) for `SessionStart`
sources (`startup|resume|clear|compact`), `UserPromptSubmit`, stdin JSON fields, and how stdout becomes context.
Existing `.claude/settings.json` has no hooks. gq-setup's company hook already runs on SessionStart (task 05).
Her main checkout is the first entry of `git worktree list --porcelain`; she may be inside `.claude/worktrees/<x>`.
## Files to touch
New `scripts/agent/session-sync.mjs` (+ test of its pure parts), `.claude/settings.json` (hooks),
`CLAUDE.md` (short "Tong Sheng's instructions" section), label setup.
## Steps
1. Script (Node, no deps, Windows + Mac), arg `--throttle 15m` for the prompt hook (timestamp in
   `$(git rev-parse --git-common-dir)/agent-sync-at`):
   - `git fetch --prune`; if main checkout is on `main` and clean, `git -C <main> pull --ff-only`. Never touch dirty trees.
   - `gh issue list --label for:vicky-claude --author ngtongsheng --state open --json number,title,body`.
   - Open `from:crm` issues whose newest comment author is `ngtongsheng` (`gh issue view --json comments`).
   - If the pull changed `CLAUDE.md` or anything under `.claude/`, print: "Rules updated: re-read CLAUDE.md and the
     skills you use before continuing." (loaded rules do not refresh mid-session).
   - When run inside a worktree, also say if the current change branch is behind `origin/main` (ship queue rebases).
   - Print nothing when there is nothing; otherwise a short block: "Tong Sheng's instructions" with each issue number,
     title and body/comment, then the rule from step 3. Any gh/network failure: print nothing, exit 0.
2. Hooks: `SessionStart` matcher for all sources and `UserPromptSubmit` with the throttle. Timeout 20 s.
3. CLAUDE.md: for each injected instruction, start a background subagent in its own worktree; it builds, runs checks,
   ships via deploy (the issue is the approval), comments the result and closes the issue (for `from:crm` replies:
   comment and close only when solved); tells Vicky one line. Ask her only for a business answer; after two failed
   fixes, comment and assign back to `ngtongsheng`.
4. `gh label create for:vicky-claude --force`.
## Acceptance
- Unit tests for issue filtering (author filter, newest-comment rule) and throttle logic pass.
- Manual: create a test issue labelled `for:vicky-claude` as owner; run `node scripts/agent/session-sync.mjs` → it
  prints the instruction; same issue authored by another account (or simulated JSON) is ignored; second run within
  15 min with `--throttle` prints nothing. Close the test issue.
- In a resumed Claude Code session in this repo, the hook output appears (check with `/hooks` or transcript). Note
  in loop.md whether `resume` fired.
## Out of scope
Ship queue logic (08).
