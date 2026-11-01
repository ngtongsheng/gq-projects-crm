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
| 01 | Bootstrap probe (fetch-and-follow) | todo | – | haiku/low |
| 02 | gq-setup README (human steps) | todo | 01 | sonnet/high |
| 03 | SETUP.md (Claude-facing setup) | todo | 01 | opus/medium |
| 04 | Dry run on owner's Mac + fixes | todo | 02, 03 | sonnet/high |
| 05 | Onboarding doc (owner + day-2) | todo | 03 | sonnet/high |
| 06 | First run with Vicky | todo | 04, 05 | sonnet/high |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- #01: in Claude Desktop (Code mode), paste the probe message; report whether Claude followed the steps.
- #04: paste the real bootstrap message in Desktop on your account in an empty folder; report what you saw.
- #06: sit with Vicky; she installs Desktop, signs in (Pro), creates a GitHub account; you add her as write collaborator when she sends her username.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-01 · plan · loop written · /execute-loop after loop 01 done
