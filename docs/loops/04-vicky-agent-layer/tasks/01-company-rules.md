---
model: opus
effort: medium
why: agent-facing rules and persona; judgment on what of the owner's setup carries over and how it reads to a non-developer
depends: []
---
# 01 Company rules, plain style, Chat profile text
## Goal
The company layer's text in `~/work/projects/gq-setup/agent/`: global rules, the generalised plain style, and the
Chat-tab profile text.
## Context
- Load `writing-for-agents` first. Loop decisions D1-D3, D10-D12.
- Sources: `~/work/config/agents/AGENTS.md` (owner's global rules), CRM `CLAUDE.md` and
  `.claude/output-styles/plain.md`, CRM `docs/glossary.md`.
- Reader of `CLAUDE.md`: Claude Code in Desktop, any folder on her Mac, imported from `~/.claude/CLAUDE.md` above her
  `## About me` profile. Project CLAUDE.md files (the CRM's) add to it; they win on project specifics.
- Public repo: no secrets, customer data, prices or internal URLs (D9).
## Files to touch
- `gq-setup/agent/CLAUDE.md`
- `gq-setup/agent/output-styles/plain.md`
- `gq-setup/agent/chat-profile.md`
## Steps
1. `agent/CLAUDE.md`, person-neutral ("the person you help"; name and role come from `## About me`):
   - Who: Claude is the product partner for someone at GQ Projects (carpet sales and installation); they say what
     the business needs, Claude does the engineering invisibly. Talk per the plain style.
   - Engineering bar adapted from AGENTS.md sections Before coding, Building, Code quality, Testing, Debugging, Done
     means, Git & shell, Safety, Tokens. Drop herdr, loops, `/plan-loop`, vault, lessons.md, Friday, Biome-specific
     lines unless generic. Git: one branch/worktree per change, conventional commits, never force-push or push main;
     a repo's own CLAUDE.md flow wins.
   - Plain-only asking: decisions go to the person as multiple-choice; anything needing Tong Sheng → `get-help` skill.
   - Subagents: spawn with model sonnet and effort high for broad searches and grunt work.
   - Fresh chats: after a change is live, or a chat runs long, suggest once, in one plain line, starting a new chat.
   - Updates: the company layer updates itself; never edit `~/GQ/gq-setup` by hand.
2. `agent/output-styles/plain.md`: start from the CRM style. Keep the frontmatter (`name: plain`,
   `keep-coding-instructions: true`); replace "Vicky" with "the person you help"; drop CRM-only lines (preview link,
   put it live, the live app) and list them in the task's log line so #06 moves them into CRM `CLAUDE.md`.
3. `agent/chat-profile.md`: ≤ 120 words for claude.ai Settings > Profile: plain words, answer first, one
   recommendation, ask one thing at a time, she runs a carpet company and is not a developer.
## Acceptance
- `wc -w gq-setup/agent/chat-profile.md` ≤ ~140 (text body ≤ 120).
- `grep -niE "herdr|plan-loop|execute-loop|vault|lessons\.md|friday" gq-setup/agent/CLAUDE.md` → no output.
- `grep -niE "vicky|preview link|put it live|live app" gq-setup/agent/output-styles/plain.md` → no output.
- Commit in gq-setup on main (`feat: add company agent layer rules and style`), push.
## Out of scope
Skills, settings, SETUP.md, CRM edits.
