# Loop 06: Setup rehearsal before Vicky's first run
Orchestrator: sonnet/high
## Goal
The 1:1 with Vicky (loop 02 #06) runs without surprises. SETUP.md and the first preview are proven end to end in a
fresh macOS user on the owner's Mac, every break found there is fixed, and the owner has a meeting runbook with a
fallback per step. Done when the rehearsal sheet shows every step pass (or a logged fallback) and onboarding.md holds
the runbook.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Rehearse the full SETUP.md in a fresh macOS admin user on the owner's Mac | Loop 02 #04 dry run skipped steps 1, 3-6 (already done on owner's account); a fresh user tests 2-14 for real. Xcode CLT is system-wide, so step 1 stays untested | Fixes from reasoning only; checklist only |
| D2 | Rehearsal uses a throwaway GitHub account (Gmail +alias), invited and accepted like Vicky | Tests signup, invite, accept (steps 5, 7) | Owner's own account (step 7 skipped) |
| D3 | Vicky gets her own admin login on the test copy (`gq-crm-dev`), seeded before the meeting | First preview must not stall at sign-in | Shared example login; no sign-in on day one |
| D4 | Keep Opus as company default model | Owner choice; runbook adds a usage check before the meeting | Sonnet default |
| D5 | Vicky's Mac facts checked at the meeting, automated by a new SETUP.md preflight (macOS version vs Node 24 minimum, admin account) that stops early with a plain message | No pre-meeting message to her; preflight makes the check automatic and repeatable | Pre-meeting message |
| D6 | Fix only what the rehearsal reproduces (suspects: preview pane can't find `pnpm` via launch.json after restart; background `gh auth login --web` in Desktop) | Reproduce first, then fix | Speculative fixes before rehearsal |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | SETUP.md preflight step (macOS version, admin) + push gq-setup | todo | – | sonnet/high |
| 02 | Rehearsal runbook + observation sheet | todo | 01 | sonnet/high |
| 03 | Owner: run rehearsal in fresh macOS user, fill the sheet | todo | 02 | owner |
| 04 | Fix rehearsal findings; owner re-pastes link to confirm repair path | todo | 03 | opus/medium |
| 05 | Meeting runbook in docs/onboarding.md | todo | 04 | sonnet/high |
| 06 | Owner: Vicky's test-copy admin, wake test copy, clean up rehearsal | todo | 05 | owner |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- #03: create a fresh macOS admin user, sign in to Claude Desktop there, run the rehearsal per
  `assets/rehearsal-runbook.md` (written by #02), fill `assets/rehearsal-sheet.md`. Make the throwaway GitHub account
  during setup step 5 and send its invite (onboarding.md section 1) when setup step 7 asks.
- #04: after fixes are pushed, paste the setup link again in the rehearsal user; confirm every step reports "already
  done" or passes.
- #06: steps in `tasks/06-owner-meeting-prep.md`.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-03 · plan · loop written · /execute-loop docs/loops/06-setup-rehearsal
