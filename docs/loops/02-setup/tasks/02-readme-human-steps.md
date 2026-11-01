---
model: sonnet
effort: high
why: plain-language writing for a non-technical reader; must be exact about clicks
depends: [01]
---
# 02 gq-setup README (human steps)
## Goal
A one-page `README.md` in `gq-setup` that takes Vicky from nothing to "message pasted", with no jargon.
## Context
- Reader: Vicky, carpet business owner, non-technical, Mac, Claude Pro. Owner sits beside her on run 1.
- Load the `writing-for-agents` skill only for tone discipline; this doc is for a human.
- Plain words per the CRM repo's `docs/glossary.md` (loop 01 #09). Never: terminal, git, repo, clone, CLI.
- Desktop docs: https://code.claude.com/docs/en/desktop.md (check current download URL, Code tab and folder picker wording).
## Files to touch
`gq-setup/README.md`
## Steps
1. Numbered steps, one action each, saying what she clicks and what she will see:
   download + install Claude Desktop → sign in with her Claude account → open the Code tab → create folder `GQ` in her
   home folder (Finder: Go → Home → New Folder) and choose it → leave permission mode on the default ("Ask") → paste the
   message (code block, one-click copy) → "Claude will explain each step and ask before doing it. Click Allow."
2. "If something goes wrong": paste the same message again; Claude picks up where it stopped. Still stuck: message Tong Sheng.
3. "Already set up? Opening the CRM next time": open Claude Desktop → Code → choose `GQ/gq-projects-crm`.
4. Push. Verify GitHub renders it: `gh repo view ngtongsheng/gq-setup --web` not needed; `gh api repos/ngtongsheng/gq-setup/readme` returns 200.
## Acceptance
README ≤ 1 screen of steps; no banned jargon (`grep -iE 'terminal|git |repo|clone|cli|npm|pnpm' README.md` → only the URL in the paste message); renders on GitHub.
## Out of scope
Windows; screenshots (add after #06 if she struggles).
