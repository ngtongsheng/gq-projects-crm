---
model: sonnet
effort: high
why: Transcript parsing and secret redaction; leaking a key into an issue is the main risk
depends: [05]
---
# 10 help-bundle and get-help attachment
## Goal
Every get-help report carries a diagnosis and her condensed current session transcript, redacted (D15).
## Context
gq-setup worktree. get-help: `agent/skills/get-help/SKILL.md` writes `$HOME/GQ/.help-report.md` then `gh issue
create/comment`. Claude Code transcripts: newest `*.jsonl` under `~/.claude/projects/*/` (check the JSONL line shape
in a local file first; user/assistant messages, tool_use, tool_result). Windows + Mac.
## Files to touch
New `agent/scripts/help-bundle.mjs` (+ test with a fixture jsonl), `agent/skills/get-help/SKILL.md`.
## Steps
1. Diagnosis: OS/arch, node/pnpm/git/gh versions, `gh auth status` user, cwd, branch, `git status -s` (first 30),
   `git worktree list`, open PRs with check states, last failed run `--log-failed` tail (40 lines), `.env.local`
   present yes/no, port 3000 listener pid.
2. Session: newest transcript; keep last ~40 user/assistant turns; tool calls as one line (`tool: summary`); tool
   output first 20 lines; total cap 50k chars.
3. Redact before output: `sb_secret_*`, `sb_publishable_*` keep prefix only, JWT-shaped strings, `postgres://...@`
   passwords, `password[:=]\s*\S+`, any `.env*` line values.
4. Output markdown with two `<details>` blocks; get-help appends it to the report file.
## Acceptance
- Fixture test: secrets in the fixture never appear in output; caps respected.
- `node agent/scripts/help-bundle.mjs` on this Mac prints both sections in < 10 s.
## Out of scope
Changing who get-help goes to.
