---
model: sonnet
effort: high
why: agent-facing setup steps on a machine we can't see; must stay idempotent and jargon-free
depends: [03]
---
# 04 SETUP.md: company layer steps
## Goal
`gq-setup/SETUP.md` installs rtk, the gq-setup checkout and the company layer, walks her through the Chat profile
paste, and asks the "about you" questions, all safe to re-run.
## Context
- Load `writing-for-agents` first. Loop decisions D6-D8, D10, D11. Read the current `SETUP.md` fully: keep its
  talk rules, check → explain → act → verify shape, `<mise>` convention and failure rule.
- `apply.py` contract and paths: `gq-setup/agent/README.md`.
## Files to touch
- `gq-setup/SETUP.md`
- `gq-setup/README.md` (only if the time estimate or step count it quotes changes)
## Steps
1. After step 3 (GitHub tool) add rtk: check `<mise> exec -- rtk --version`; else `<mise> use -g rtk`.
2. After "Download the CRM" add "Download the GQ helper": clone `https://github.com/ngtongsheng/gq-setup.git` to
   `~/GQ/gq-setup` if absent; else pull only on clean main (same rule as the CRM step).
3. Then "Set up Claude for you": `/usr/bin/python3 ~/GQ/gq-setup/agent/apply.py`; explain as "setting Claude up to
   work the GQ way, on every chat"; show warnings to her only as one plain line, details via the failure rule.
4. Then "Chat tab": `pbcopy < ~/GQ/gq-setup/agent/chat-profile.md`; numbered steps to open Claude Settings > Profile,
   paste, save; ask (AskUserQuestion) whether it's done. Check the current Desktop label names in Anthropic's docs.
5. Then "About you": if `~/.claude/CLAUDE.md` contains `## About me`, skip. Else 4 AskUserQuestion prompts (what to
   call her, role, most time on, how much detail), append the `## About me` block below the import line with Write
   or Edit. Tell her she can ask Claude any time to change it.
6. Renumber steps and every "Step N of M" line; update the greeting's time estimate.
## Acceptance
- `grep -c "of 9" gq-setup/SETUP.md` → 0; every "of M" uses the new total.
- Quoted lines she is told (`"..."` in SETUP.md) contain none of: terminal, shell, PATH, repository, clone, CLI.
- Commit in gq-setup (`feat: set up the company agent layer during setup`), push.
## Out of scope
The dry run (#05); CRM changes (#06).
