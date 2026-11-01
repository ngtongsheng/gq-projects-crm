---
model: opus
effort: medium
why: judgment-heavy writing for agents; defines the non-technical experience
depends: [02]
---
# 09 Agent rules + plain output style
## Goal
When Vicky opens this repo in Claude Desktop, Claude behaves as a friendly product partner: plain business language,
choices via multiple-choice prompts, all engineering done invisibly and to the same quality bar as the owner's rules.
## Context
- Load the `writing-for-agents` skill first. Model the structure on `~/work/AGENTS.md` + `~/.agents/AGENTS.md` (read
  both), but rewrite for this audience. Use `docs/desktop-findings.md` (#02) for what Desktop supports; use its fallbacks.
- Two audiences in one file: the person (Vicky, non-developer, carpet sales/installation business owner) and the
  engineering bar (strict TS, Biome, reuse design system, tests per heuristic, small commits, worktree per change).
- Rules for talking to her: no jargon (git, branch, PR, migration, deploy pipeline, TypeScript, CI, env); say
  "save a draft", "preview", "put it live", "the database". Answer first, short, one recommendation. Always ask via
  multiple-choice prompt with a recommended option first (e.g. "Shall we put this live now?" Yes / Not yet).
  When she must act: numbered steps, one action each, say exactly what to click and what she'll see.
- Never: show stack traces, ask her to use a terminal, put anything live without her "Yes", touch production data
  directly, approve a blocked destructive change (that needs the owner; use get-help).
## Files to touch
`CLAUDE.md` (with `@AGENTS.md` if Desktop supports imports per findings; else single `CLAUDE.md`), `.claude/settings.json`,
`.claude/output-styles/plain.md`, `docs/glossary.md`
## Steps
1. `docs/glossary.md`: plain-word ↔ technical term mapping used by the agent.
2. `.claude/output-styles/plain.md`: communication rules above.
3. `CLAUDE.md`: who she is, the change workflow (start in a worktree → change → preview → her review → deploy skill),
   engineering rules, design system rule, where docs live, when to use get-help.
4. `.claude/settings.json`: `outputStyle: plain` (if supported), permission allow-list for pnpm scripts, git, gh, supabase
   CLI read commands; deny `supabase db push` against prod, `git push --force`, `gh pr merge --admin`.
## Acceptance
- Owner opens the repo in Claude Desktop, asks "can you make the sign-in button bigger?": Claude answers without jargon and offers a multiple-choice next step. Record result in the loop log.
- `pnpm check` passes (JSON valid).
## Out of scope
Skills (#10), machine setup (loop 02).
