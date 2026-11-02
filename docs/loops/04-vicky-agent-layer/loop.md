# Loop 04: Vicky's global agent layer
Orchestrator: sonnet/high
## Goal
After setup, every Claude Code session on Vicky's Mac (not just the CRM folder) runs like the owner's Friday setup
minus dev workflow tools: company rules with a hidden professional engineering bar, plain style, tdd /
diagnosing-bugs / grilling / get-help skills, token-saving settings, and an "about you" profile. The company layer
lives in public `ngtongsheng/gq-setup` under `agent/` and updates itself at session start. Verified by a scratch-HOME
dry run; Vicky's first run (loop 02 #06) is the real test. Must land before loop 02 #06.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Company layer in public `gq-setup/agent/`, cloned to `~/GQ/gq-setup`. Built and tested for Vicky; written person-neutral ("the person you help") because her details live in her profile (D11) | Future company rollout: every employee runs the same setup and gets the same rules/skills | Separate gq-agent repo; Vicky-only wording |
| D2 | `agent/CLAUDE.md` = owner's `~/work/config/agents/AGENTS.md` adapted in full: product-partner persona, engineering bar, testing, debugging, git matching the CRM flow, safety, tokens, fresh-chat nudge after a change is live or a chat runs long, subagents spawned with sonnet + high effort. Mistakes/blocks go through get-help, not lessons.md. No Friday, herdr, loops, vault | Same hidden quality wherever she works | Persona only; engineering + tokens only |
| D3 | `agent/output-styles/plain.md` = CRM plain style generalised to any work; CRM-only lines (preview, put it live, live app) move into CRM `CLAUDE.md`. gq-setup is the source; CRM keeps a byte-identical copy checked by a CI step | Style now applies to all her sessions; CRM must still work without setup | Two drifting copies; CRM relying on global only |
| D4 | Skills in `agent/skills/`: tdd, diagnosing-bugs, grilling (adapted: no herdr/loops/vault, plain-style aware), get-help moved from CRM to global, always filing in the private CRM repo with a `from:crm` / `from:other` label | Owner choice; one private inbox for help | prototype, writing-for-agents, plan/execute, herdr; public issues in gq-setup |
| D5 | `agent/settings.json`: `model` opus, `modelSettings` opus medium / sonnet high, env `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`, owner's Read deny list, rtk PreToolUse hook, SessionStart hook running the apply script, `outputStyle: plain` | Owner choice; Opus on Pro burns limits faster (accepted) | Sonnet default |
| D6 | One idempotent `agent/apply.py` (python3 from Apple CLT, stdlib only): pull gq-setup when on clean main, ensure the import line, symlink style + skills, merge settings keys (hers kept). Run by setup and by the SessionStart hook; never fails the session | Rules, style, skills and settings update with no clicks and no tokens. Risk: whoever can push gq-setup runs code on her Mac; only the owner can (accepted, record in decisions.md) | Claude pulls via rules (Allow click, tokens); re-paste only |
| D7 | `~/.claude/CLAUDE.md` gets one `@~/GQ/gq-setup/agent/CLAUDE.md` import line (added once); existing content kept | Doesn't clobber anyone's own config | Symlinking whole files |
| D8 | rtk installed via mise (`mise use -g rtk`) in setup | Owner choice: compress long command output | Defer to debt.md |
| D9 | gq-setup stays public; rules hold no secrets, customer data or prices; a secrets grep runs in the dry run | Bare-link setup must fetch before GitHub sign-in | Private repo |
| D10 | Chat tab: `agent/chat-profile.md` short text; setup copies it with `pbcopy` and walks her to Settings > Profile to paste | Chat ignores CLAUDE.md | Code tab only |
| D11 | Setup's last step before hand-off: "about you" with 4 multiple-choice questions (call you, role, most time on, detail level), saved as `## About me` under the import line. Skipped when present; she can ask Claude to redo it | Company layer is the owner's; personal layer is hers and never overwritten | All fixed by owner; she writes rules |
| D12 | No owner review pause; the company layer is a first draft, co-authored with Vicky as a gq-setup contributor if the company adopts agentic workflows | Owner choice | Review after #01 |
| D13 | Test with HOME pointed at a scratch folder, twice (empty and pre-seeded with existing CLAUDE.md/settings.json); Desktop behaviour (hooks, rtk, user output style, import, one-session update lag) checked in loop 02 #06 | Owner's own `~/.claude` is Friday; no test rig (loop 02 D6) | Separate macOS user |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Company rules, plain style, Chat profile text | done | – | opus/medium |
| 02 | Global skills: tdd, diagnosing-bugs, grilling, get-help | in-progress | 01 | sonnet/high |
| 03 | settings.json + apply.py | todo | 01 | opus/medium |
| 04 | SETUP.md: rtk, gq-setup, apply, Chat profile, about you | todo | 03 | sonnet/high |
| 05 | Scratch-HOME dry run + fixes | todo | 02, 04 | sonnet/high |
| 06 | CRM: style copy, CLAUDE.md lines, drift CI, docs, remove CRM get-help | todo | 01, 02 | sonnet/high |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- None during the loop. Afterwards, in loop 02 #06 with Vicky: confirm the Chat profile paste, that the plain style and
  skills work outside the CRM folder, that hooks and rtk run in Desktop, and how many sessions an update takes.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-02 · plan · loop written · /execute-loop; loop 02 #06 waits for this loop
2026-11-02 · #01 · in-progress · worktree gq-projects-crm-loops/04-vicky-agent-layer · delegating (opus/medium)
2026-11-02 · #01 · done · gq-setup commit eb3e617 verified locally; push to origin was denied by the permission system, so gq-setup main is 1 ahead (owner action: push) · #02
2026-11-02 · #01 · decision · chat profile written person-neutral (D1) · future staff can paste the same text
2026-11-02 · #01 · decision · CRM-only style lines dropped from plain.md for #06 to move into CRM CLAUDE.md: glossary word list (save a draft, preview, preview link, put it live, the database, the test copy, the live app); example "Yes, put it live"; example "Click **Preview** at the top right"; "live app only changes after she picks Yes on a prompt that asks exactly that"
2026-11-02 · #02 · in-progress · delegating (sonnet/high)
