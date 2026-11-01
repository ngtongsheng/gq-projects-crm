# Loop 02: Setup skill + first run
Orchestrator: sonnet/high
## Goal
Vicky installs Claude Desktop, pastes one message, and Claude sets up her Mac (git, mise, node, pnpm, gh, GitHub
access, clone to `~/GQ/gq-projects-crm`, first preview) with no terminal and no jargon. Verified on the owner's Mac,
then done for real with Vicky, owner present. Start only after loop 01 is done (needs its kit #09/#10 and pipeline #08).
## Decisions
Inputs from loop 01 D11 and `docs/decisions.md` ("Loop 02 inputs") still apply: Mac only, no Homebrew, no ZIP, Pro plan, owner present.
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Public repo `ngtongsheng/gq-setup`: `README.md` (human steps before Claude can help) + `SETUP.md` (Claude-facing steps). Plugin marketplace built only if #01 shows "fetch and follow" fails | Raw fetch verified (findings row 7); one channel is less to maintain | Both channels |
| D2 | Setup runs in Desktop's default Ask-permissions mode; SETUP.md makes Claude explain each step in plain words before the prompt; she clicks Allow | No project allow-list exists before clone; auto mode is a bad daily habit | Auto mode for setup |
| D3 | Project path `~/GQ/gq-projects-crm` | No spaces; outside iCloud-synced Documents/Desktop (sync corrupts .git/node_modules) | `~/Documents/GQ CRM` |
| D4 | Vicky = write collaborator. Owner sends the invite; Claude accepts it via `gh api user/repository_invitations` | She can't change settings/secrets/rules; no GitHub web clicks for her | Admin |
| D5 | SETUP.md is idempotent: each step checks first, skips if done. Re-pasting the same message is the repair path | One flow to maintain and test | Separate repair/doctor flow |
| D6 | Dry run on owner's own Mac account (idempotency + Desktop run by owner); Vicky's first run is the fresh-install test | Owner choice: no test rig | Fresh macOS user, no dry run |
| D7 | Git identity from her GitHub account with the GitHub noreply email | Keeps her email private in commit history | Her personal email |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Bootstrap probe (fetch-and-follow) | blocked: owner — create public repo (classifier denied), then paste probe message | – | haiku/low |
| 02 | gq-setup README (human steps) | done | 01 | sonnet/high |
| 03 | SETUP.md (Claude-facing setup) | done | 01 | opus/medium |
| 04 | Dry run on owner's Mac + fixes | blocked: #01 repo + loop 01 merged to main (clone needs the app) | 02, 03 | sonnet/high |
| 05 | Onboarding doc (owner + day-2) | blocked: loop 01 merged to main (needs CLAUDE.md, kit) | 03 | sonnet/high |
| 06 | First run with Vicky | todo | 04, 05 | sonnet/high |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- #01: in Claude Desktop (Code mode), paste the probe message; report whether Claude followed the steps.
- #04: paste the real bootstrap message in Desktop on your account in an empty folder; report what you saw.
- #06: sit with Vicky; she installs Desktop, signs in (Pro), creates a GitHub account; you add her as write collaborator when she sends her username.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-01 · plan · loop written · /execute-loop after loop 01 done
2026-11-02 · start · decision · run #01-#03 now though loop 01 not done (#08-#11 open) · they only touch the separate gq-setup repo; #04-#06 wait for loop 01 merge
2026-11-02 · #01 · decision · record row 7 result in this log, copy into docs/desktop-findings.md after loop 01 merges · file exists only on loop/01-foundation
2026-11-02 · #01 · in-progress · delegating (haiku/low)
2026-11-02 · #01 · blocked: owner · auto-mode classifier denied `gh repo create ngtongsheng/gq-setup --public` (Create Public Surface); nothing created · owner runs it, executor then writes probe + pushes
2026-11-02 · #02 · decision · write #02/#03 now in local git repo ~/work/projects/gq-setup (no remote) though #01 blocked · content doesn't depend on probe result; push when repo exists; marketplace fallback added only if probe fails
2026-11-02 · #02 · in-progress · delegating (sonnet/high)
2026-11-02 · #02 · done · README.md committed locally in gq-setup; jargon grep clean; push + GitHub render check deferred until #01 repo exists
2026-11-02 · #02 · decision · Desktop default mode is now labelled "Manual" (older: "Ask permissions"); "press" not "click" (grep caught "cli"); folder-button label and Finder path unverified · from current Desktop docs; confirm on #04/#06
2026-11-02 · #02 · note · README says "About 10 minutes"; whole setup is ~30-45 min: fix in #04
2026-11-02 · #03 · in-progress · delegating (opus/medium)
2026-11-02 · #03 · done · SETUP.md (steps 0-9 + failure rule) committed locally in gq-setup; 0 sudo/brew; every step check-first · push with #01
2026-11-02 · #03 · decision · git check via `xcode-select -p` (git --version triggers the popup); mise shims in ~/.zprofile + activate in ~/.zshrc; gh auth login run in background with --clipboard, Claude opens device page; access via .permissions.push, accept invite by PATCH; pull only if on clean main; quit + reopen Desktop before hand-off · subagent defaults
2026-11-02 · #03 · note · #04 must verify: background Bash in Desktop + device code output; gh --web prompts without a TTY; `gh auth setup-git` may pin a versioned mise path (breaks on gh update → debt.md); pnpm build-script approval prompts; Apple/GitHub button labels; README time estimate
2026-11-02 · #04 · blocked · needs #01 public repo (owner) and loop 01 merged to main (CRM app to clone/install)
2026-11-02 · #05 · blocked · needs loop 01 merged to main (CLAUDE.md + skills to check)
