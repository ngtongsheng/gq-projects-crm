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
| 01 | Bootstrap probe (fetch-and-follow) | done | – | haiku/low |
| 02 | gq-setup README (human steps) | done | 01 | sonnet/high |
| 03 | SETUP.md (Claude-facing setup) | done | 01 | opus/medium |
| 04 | Dry run on owner's Mac + fixes | done | 02, 03 | sonnet/high |
| 05 | Onboarding doc (owner + day-2) | done | 03 | sonnet/high |
| 06 | First run with Vicky | blocked: owner — run docs/onboarding.md first-run script with Vicky | 04, 05 | sonnet/high |
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
2026-11-02 · vault · ~/work/vault/sessions/gq-projects-crm/2026-11-02-loop-02-setup.md
2026-11-02 · #01 · owner created public gq-setup; README + SETUP.md pushed; raw SETUP.md returns 200
2026-11-02 · #01 · decision · probe lives in PROBE.md, not SETUP.md · keeps the real SETUP.md live; probe pushed (1452c9f) · owner pastes probe message
2026-11-02 · #01 · done · owner ran probe in Desktop: all 3 steps done, ~/gq-probe/result.txt = SETUP-OK (verified, folder removed); row 7 updated · fetch-and-follow works, no marketplace channel needed (D1)
2026-11-02 · merge · loop 01 merged to main (e9f3c25); merged into loop/02-setup · #04, #05 unblocked
2026-11-02 · #05 · in-progress · delegating (sonnet/high)
2026-11-02 · #05 · done · docs/onboarding.md (invite, first-run script, updates, off-boarding per editor); pnpm check pass
2026-11-02 · #05 · decision · step 3 gap: CLAUDE.md had no pull at session start → added "git pull --ff-only when on clean main" (matches SETUP.md step 7); invites via repos/.../invitations incl. expired resend; off-boarding also cancels pending invites · spec gaps
2026-11-02 · #04 · in-progress · delegating executor walk-through (sonnet/high)
2026-11-02 · #04 · step 1 done · checks report "already done" (steps 1, 3-6); clone to ~/GQ-dryrun + mise install + pnpm install (no prompts) + typecheck pass; gq-setup fixes pushed
2026-11-02 · #04 · decision · replaced `gh auth setup-git` with git config pointing at the mise shim (setup-git pins versioned gh path, verified in scratch config); README total time 45-60 min; "of 9" status lines · avoids breakage on gh update
2026-11-02 · #04 · note · owner Mac uses Homebrew mise, so SETUP step 2 check misfires there (would curl-install); fine for Vicky's fresh Mac. Owner dry run must tell Claude: dry run, clone into ~/GQ-dryrun, don't change shell profile or git config
2026-11-02 · #04 · blocked: owner · Desktop run of README message in ~/GQ-dryrun to hand-off
2026-11-02 · #04 · decision · owner Desktop dry run (read-only) found 2 bugs: duplicate mise install when mise exists elsewhere; git identity overwritten → SETUP.md now detects existing mise (command -v + known paths) and sets identity only when unset; pushed · step 9 hand-off + preview still to confirm by owner
2026-11-02 · #04 · done · owner Desktop session on ~/GQ-dryrun/gq-projects-crm: "show me the app" opened preview on sign-in page, plain language, admin-only note shown (D3) · full fresh install untested until #06
2026-11-02 · #04 · decision · ~/GQ-dryrun left for owner to remove after closing the Desktop session · deleting it under a running preview breaks the session
2026-11-02 · #06 · blocked: owner · first run with Vicky
2026-11-02 · merge · decision · merge #01-#05 to main via PR before #06 · Vicky clones main and needs onboarding.md + pull-on-start rule; direct push to main is denied by project settings; branch kept for #06 log
2026-11-02 · merge · #01-#05 merged to main (PR #8, all checks pass) · vault ~/work/vault/sessions/gq-projects-crm/2026-11-02-loop-02-setup.md
