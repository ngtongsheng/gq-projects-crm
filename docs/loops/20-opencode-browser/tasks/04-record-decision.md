---
tier: economy
why: Writing given conclusions into two existing docs.
depends: [03]
---
# 04 Record the decision
## Goal
A future agent (or Vicky) can tell how browser control works, why it is unprompted, and what to check when it breaks.
## Context
- `docs/decisions.md` holds one entry per decision with a date. Read its last entries for the shape before writing.
- `CLAUDE.md` is the repo's instruction file for agents. Add one short line so agents know to check a page themselves
  instead of describing it for Vicky.
- Facts to record: opencode cannot load Claude in Chrome (Claude-only tools); `chrome-devtools-mcp` 1.13.0 with
  `--autoConnect` drives her real Chrome; the setting lives in `~/.config/opencode/opencode.jsonc`; browser tools are
  not prompted (owner decision 2026-11-15); limits: Chrome 144+, remote debugging enabled at
  `chrome://inspect/#remote-debugging`, macOS Files and Folders grant for Ghostty, the Allow dialog, page content and
  prompt injection.
- Note the observed result of task 01 and 03: whether the Allow dialog repeated, and the result of the end-to-end run.
## Files to touch
- `docs/decisions.md`
- `CLAUDE.md`
## Steps
1. Append a section to `docs/decisions.md` headed `## Loop 20 (browser control in opencode), decided 2026-11-15`, in
   the same bullet style as the other sections.
2. Add one line to `CLAUDE.md` under "Where things live": browser control lives in her opencode settings, the agent may
   open `http://localhost:3000` and the live app in her Chrome, screenshots and clicks are not prompted, and the limits
   are listed in the decision entry.
## Acceptance
- `pnpm check` passes (both files are linted).
- The decision entry names the package version, the connection method, the permission choice and the limits.
## Out of scope
Rewriting `CLAUDE.md` sections, documenting the tool list, adding skills.
