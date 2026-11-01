---
model: haiku
effort: low
why: writing a given checklist; the owner runs it
depends: [01]
---
# 02 Desktop spike checklist
## Goal
Verify the Claude Desktop (Code mode) behaviors the agent kit (#09, #10) and loop 02 depend on, on the owner's Mac.
## Context
Research (2026-11-01) left these unverified: AskUserQuestion multiple-choice prompts in Desktop; project
`.claude/output-styles` + `outputStyle` in project settings; project `.claude/skills` loading; worktree toggle; dev
server preview via `.claude/launch.json`; `/plugin marketplace add <public repo>` from the Desktop prompt; Claude fetching
a public raw GitHub URL and following it as setup instructions. Docs: https://code.claude.com/docs/en/desktop.md
## Files to touch
`docs/desktop-findings.md`
## Steps
1. Write `docs/desktop-findings.md`: a checklist, one row per behavior above: what to type/click, expected result, a
   `Result:` blank. Include a tiny test skill and output style snippet the owner can drop in to test loading.
2. Park as `blocked: owner — run docs/desktop-findings.md in Claude Desktop` and continue other tasks.
3. When results arrive: record them; for each failed behavior, note the fallback (e.g. no AskUserQuestion → numbered
   options in text) so #09/#10 use it.
## Acceptance
Checklist exists with 7 rows; after owner run, every row has a Result and, if failed, a fallback.
## Out of scope
Building the kit.
