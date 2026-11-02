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
| 02 | Global skills: tdd, diagnosing-bugs, grilling, get-help | done | 01 | sonnet/high |
| 03 | settings.json + apply.py | done | 01 | opus/medium |
| 04 | SETUP.md: rtk, gq-setup, apply, Chat profile, about you | done | 03 | sonnet/high |
| 05 | Scratch-HOME dry run + fixes | done | 02, 04 | sonnet/high |
| 06 | CRM: style copy, CLAUDE.md lines, drift CI, docs, remove CRM get-help | done | 01, 02 | sonnet/high |
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
2026-11-02 · #02 · done · gq-setup commit 9d58c6f verified; push pending (owner) · #03
2026-11-02 · #02 · decision · dropped Codex openai.yaml and hitl-loop.template.sh (needs terminal); option 10 is a guided click-through · plain style says no terminal
2026-11-02 · #03 · in-progress · delegating (opus/medium)
2026-11-02 · #03 · done · gq-setup commit 1be5639; scratch-HOME rerun identical, her CLAUDE.md and settings keys survive; push pending (owner) · #04
2026-11-02 · #03 · decision · SessionStart matcher startup|resume (docs), 20s hook timeout, company hook entry replaces her same-command entry, absolute link paths · per current Claude Code docs
2026-11-02 · #04 · in-progress · delegating (sonnet/high)
2026-11-02 · #04 · done · gq-setup commit 0514144 verified (no "of 9", no banned words in quotes); push pending (owner) · #05
2026-11-02 · #04 · decision · About me appended at end of CLAUDE.md; Chat step asks "already pasted?" to skip on re-run; "Authorize GitHub CLI" quote changed to "Authorize" · Chat tab Desktop labels (Profile / Your Claude) to confirm in loop 02 #06
2026-11-02 · #05 · in-progress · delegating (sonnet/high)
2026-11-02 · #05 · done · scratch-HOME dry run: empty and seeded HOMEs identical across 2 runs (and after About me); hers kept (text, About me, theme, deny, hooks, real tdd dir + warning); hook resolves under scratch HOME; dirty/branch/behind/bad-origin all exit 0 with --quiet; secrets grep clean; one fix, gq-setup 3765569 (pull failure shows git's reason); push pending (owner), gq-setup main 5 ahead of origin · #06
2026-11-02 · #05 · for loop 02 #06 · confirm in Desktop: @~/GQ import loads; SessionStart hook (startup|resume) fires; rtk hook runs; company model/outputStyle reset each session start (D5); sessions an update takes; Chat tab label (Profile / Your Claude); pbcopy step not run in dry run
2026-11-02 · #06 · in-progress · delegating (sonnet/high)
2026-11-02 · #06 · blocked: owner · CRM changes done and verified locally (pnpm check/typecheck/test pass, 72 tests, style diff clean). The new CI drift step fetches gq-setup main from GitHub, which lacks plain.md changes until gq-setup is pushed, so the PR would fail · owner: `git -C ~/work/projects/gq-setup push origin main`, then re-run /execute-loop to merge
2026-11-02 · #06 · decision · drift step lives in the existing checks job as a named step · task named no job
2026-11-02 · vault · ~/work/vault/sessions/gq-projects-crm/2026-11-02-loop-04-vicky-agent-layer.md
2026-11-02 · #06 · done · owner pushed gq-setup (3765569); CI drift command now clean against GitHub · merging
2026-11-02 · merged to main
