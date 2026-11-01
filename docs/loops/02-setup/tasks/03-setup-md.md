---
model: opus
effort: medium
why: agent-facing instructions with branching, idempotency and failure handling on a machine we can't see
depends: [01]
---
# 03 SETUP.md (Claude-facing setup)
## Goal
`gq-setup/SETUP.md`: instructions Claude follows to take a fresh Mac to a working CRM checkout and first preview, safe to re-run.
## Context
- Load `writing-for-agents` first. Loop decisions D2-D5, D7; `docs/decisions.md` "Loop 02 inputs"; `docs/desktop-findings.md`.
- Reader is Claude in Desktop Code mode, cwd `~/GQ`, Ask-permissions mode, no project settings yet. User is non-technical:
  before each command, one plain sentence on what it does and that a permission prompt follows. Choices via
  AskUserQuestion (findings row 1). No jargon, no stack traces to her.
- Check current install docs before writing commands: mise (https://mise.jdx.dev/installing-mise.html, user-level
  `curl https://mise.run | sh`, zsh activation), gh (via mise), Xcode Command Line Tools (`xcode-select --install` popup).
- Desktop's Bash tool may not load `~/.zshrc`: call tools by absolute path (`~/.local/bin/mise`) or `mise exec --`; verify.
## Files to touch
`gq-setup/SETUP.md`
## Steps
Write these as steps, each with: check → skip if done → explain → act → verify → plain status line ("3 of 9 done").
1. Greet; explain ~30 min, she'll click Allow several times; ask "Ready?" (Yes / Not now).
2. Git: `git --version` works without popup → skip; else `xcode-select --install`, tell her exactly which button to click in the Apple popup, wait for her "done".
3. mise user-level install + zsh activation line (only if absent).
4. gh via `mise use -g gh`; verify `gh --version`.
5. GitHub account: ask "Do you have a GitHub account?" No → numbered steps for github.com sign-up (username suggestion, email, verify code).
6. `gh auth login --web --git-protocol https` (device code: say she'll see an 8-character code, copy it into the browser page). `gh auth setup-git`. Git identity: name from `gh api user`, email `<id>+<login>@users.noreply.github.com` (D7).
7. Repo access: `gh api user/repository_invitations` → accept the one for `ngtongsheng/gq-projects-crm` (PATCH). None and no access → tell her: "Send your GitHub username (<login>) to Tong Sheng and tell me when he replies", then re-check.
8. Clone to `~/GQ/gq-projects-crm` if absent; else `git pull` on main. Then `mise trust` + `mise install` in the repo, `pnpm install`.
9. Hand-off: tell her to open a new Code session on folder `GQ/gq-projects-crm` (exact clicks), where the CRM's own Claude rules take over, and to type "show me the app" (triggers the preview skill from loop 01 #10).
10. Failure rule: any step fails twice → stop, show one plain sentence, tell her to send a screenshot to Tong Sheng; never improvise destructive fixes (no `sudo`, no deleting folders).
## Acceptance
- Static: every step has a check-before-act; no `sudo`, no `brew`, no secrets; `grep -c 'sudo\|brew' SETUP.md` → 0.
- Dry-run verification is #04.
## Out of scope
Windows; Claude Desktop install (README, #02); in-repo kit content (loop 01).
