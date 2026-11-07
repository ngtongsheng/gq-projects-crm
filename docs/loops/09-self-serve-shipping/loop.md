# Loop 09: Self-serve shipping for Vicky
Orchestrator: opus/medium
## Goal
Vicky makes a change, says the preview looks right, and it is live, with no git knowledge and no waiting on Tong Sheng
except for accounts, secrets and billing. Her agent pulls the latest repo and acts on Tong Sheng's instructions without
her attention, works on Windows and Mac, can try database and admin features on the test copy from her laptop, and
sends a diagnosis plus session transcript when it does ask for help. Her stuck PRs (21-31) are live.

## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Vicky's agent is autonomous. Vicky (MD) approves business rules: who sees what, new columns, backfills. Tong Sheng only for accounts, secrets, billing, or a step that still fails after 2 fixes | Internal 17-person app; 3 of 7 PRs sat parked on approvals she should own | Keep permission/auth changes with owner |
| D2 | Real data loss (drop table/column, delete/truncate rows, retype) still trips the guard. Agent asks Vicky in plain words naming what disappears; on her yes it adds label `data-loss-approved` (renamed from `owner-approved`) and ships. `migrate-prod` dumps prod before every push (artifact, 30 days) | Supabase Free has no backups; loss must be recoverable | No gate; owner-only label |
| D3 | Guard allows `drop policy/function/trigger/view/index` (no stored data). Still blocks table/column/type/data loss | PRs 23 and 29 failed on `drop policy` false positives | Allow-list per file |
| D4 | Her "looks right" on the preview is the go-live yes. No second "put it live?" prompt | She expects changes to apply automatically | Keep explicit yes; ship at session end |
| D5 | Small changes and fixes batch into one change branch/PR from `main`. New module or breaking change gets its own PR. Never stack PRs on other PRs | Stacked chain 21->25->27->23->29 blocked everything | One PR per change |
| D6 | Ship queue at session start: merge green PRs she approved, rebase the rest on `main`, close superseded ones, remove merged worktrees, one-line status to her | She cannot manage git | Manual PR handling |
| D7 | Tests by role: MD "Sign in as" (PR 25) on live; on laptop a `test-sign-ins` skill resets the test-copy role sign-ins and shows them | She asked to see each role's view | Role switcher in dev only |
| D8 | PRs 21, 23, 25 approved by owner (company rating, MOF cost to Purchasing not Sales Director, MD Sign in as + new link). Consolidate the chain onto `main` and ship | Owner decision 2026-11-07 | Review each |
| D9 | Agent scripts are Node, cross-platform (Windows + Mac). No `lsof`, `kill`, `python` assumptions; `apply.py` ported to Node | She is on Windows now, Mac later | Mac-only |
| D10 | `.gitattributes` `* text=auto eol=lf`; Biome formatter back on for her | Her agent turned the formatter off due to CRLF | - |
| D11 | One-time paste: Tong Sheng sends the dev secret key and dev DB password privately; `connect-test-copy` skill writes them to `.env.local`. `pnpm db:test-copy` pushes pending migrations to `gq-crm-dev` only and refuses any other ref. Prod values never on her laptop | PRs 30/31 were made only to get migrations onto the test copy | Vercel CLI pull (Hobby has no seats); committed secrets |
| D12 | Weekly `health.yml`: query dev and prod (prevents 7-day pause), check `SUPABASE_ACCESS_TOKEN`, open an `Urgent:` issue assigned to owner on failure | Free plan pauses; CI token expires after 90 days | Manual reminders |
| D13 | Nightly `backup.yml`: prod `pg_dump` (schema + data) to an Actions artifact, 30-day retention | No backups on Free | Supabase Pro now (deferred to handover) |
| D14 | Session-sync hook (`SessionStart` all sources + `UserPromptSubmit` throttled to 15 min): ff-pull the main checkout when clean, else fetch; list open `for:vicky-claude` issues authored by `ngtongsheng` and open `from:crm` issues whose newest comment is by `ngtongsheng`; inject them as instructions. The agent runs each in a background subagent in its own worktree, ships without asking her (owner instruction is the approval), comments the result and closes the issue, tells her one line. Asks her only for a business answer; after 2 failures assigns back to owner | She should not have to notice; owner can steer remotely | Inbox file in repo; poller daemon |
| D15 | `get-help` attaches a diagnosis and the condensed current session transcript (last ~40 turns, tool output cut to 20 lines, 50k char cap, secrets redacted) in collapsed `<details>` blocks | Owner can act without asking her | Full raw transcript; secret gist (public by URL) |
| D16 | `SETUP.md` (gq-setup) gains a Windows path: winget for Git, gh, mise; Node/pnpm via mise; `core.autocrlf false`. Mac path unchanged; re-run is the repair path | She set up Windows by hand; Mac coming | Separate Windows doc |
| D17 | Work branch `loop/09-self-serve-shipping` in a worktree per repo (crm and gq-setup); one commit per task; merge pre-approved once checks pass. Task 11 merges Vicky's PRs itself | Same as earlier loops | Commit to main |

## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Fix next-themes script warning | done | - | sonnet/high |
| 02 | Guard false positives, prod dump, nightly backup, label rename | done | - | sonnet/high |
| 03 | Weekly health workflow | done | - | sonnet/high |
| 04 | LF line endings + cross-platform preview | done | - | sonnet/high |
| 05 | Port gq-setup apply.py to Node | done | - | sonnet/high |
| 06 | Rewrite agent rules (CLAUDE.md, deploy, get-help triggers) | done | 02 | opus/medium |
| 07 | Session-sync hook and remote instructions | in-progress | 06 | opus/medium |
| 08 | Ship-queue skill | todo | 06 | sonnet/high |
| 09 | Test-copy kit (connect, db:test-copy, test sign-ins) | todo | 04 | sonnet/high |
| 10 | help-bundle and get-help attachment | todo | 05 | sonnet/high |
| 11 | Consolidate and ship PRs 21-31 | todo | 01, 02, 06 | opus/medium |
| 12 | Docs and plain note for Vicky | todo | 01-11, 13 | sonnet/high |
| 13 | Windows path in SETUP.md | todo | 05 | opus/medium |

## Owner actions
- Rollout (after the loop merges): tell Vicky "Open a new chat, say *get the latest CRM*, then close it and open
  another." First session pulls; rules, skills and hooks load from the second session on.
- Dev DB password: if lost, reset it in the `gq-crm-dev` dashboard, then `gh secret set SUPABASE_DEV_DB_PASSWORD`.
- After #09: send Vicky the dev secret key and dev DB password privately (WhatsApp), never in git or issues.
- After #11: sign in as MD on https://gq-projects-crm.vercel.app and try "Sign in as" and "Back to my account".
- After #07 ships: open one test issue labelled `for:vicky-claude` (e.g. a copy tweak) and confirm it goes live.
- After #13 ships: ask Vicky to paste the setup link once on her Windows PC, then start a new session.

## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-07 · plan · loop written · /execute-loop
2026-11-07 · setup · worktrees crm + gq-setup on loop/09-self-serve-shipping · #01
2026-11-07 · #01 · in-progress · sonnet/high
2026-11-07 · #01 · decision · replaced next-themes with local ThemeScript (server, in head) + ThemeProvider · no fixed release exists (0.4.6 latest)
2026-11-07 · #01 · decision · biome-ignore noDangerouslySetInnerHtml on the constant theme script · React escapes children scripts; no user input
2026-11-07 · #01 · done · check/typecheck/test pass; browser: no console errors, stored theme applied on reload (sign-in page; signed-in pages share the layout)
2026-11-07 · #02 · in-progress · sonnet/high
2026-11-07 · #02 · decision · backup.yml is reusable (workflow_call); migrate-prod needs it · one copy of the dump steps
2026-11-07 · #02 · decision · label rename + backup run happen after merge (post-merge step) · avoid stale labels on open PRs
2026-11-07 · #02 · done · guard tests 63 pass; PR 23 migration not blocked; no owner-approved in .github/scripts
2026-11-07 · #03 · in-progress · sonnet/high
2026-11-07 · #03 · decision · keep-awake via `supabase db query --linked "select 1"` (token only); run red on simulated failure · no DB password needed
2026-11-07 · #03 · done · YAML parsed, report script stub-tested, secrets + from:crm label exist; GitHub dispatch runs after merge (new workflows need to be on main)
2026-11-07 · #04 · in-progress · sonnet/high
2026-11-07 · #04 · decision · free-port kills only the LISTEN pid; Windows detects listeners by foreign `:0`, not the localized word · safe + locale-proof
2026-11-07 · #04 · done · Mac: dev up, `pnpm free-port` freed 3000; netstat parser unit-tested; check/typecheck/test (933) pass; renormalize changed no files
2026-11-07 · #05 · in-progress · sonnet/high (gq-setup worktree)
2026-11-07 · #05 · decision · hook uses `node "$HOME/GQ/gq-setup/agent/apply.mjs" --quiet`; dirs as junctions, copy fallback tracked in ~/.claude/.gq-apply-copies.json · works without admin on Windows
2026-11-07 · #05 · decision · bare `node` on hook PATH and `$HOME` under Windows shells unverified → task 13 must make node global (mise) · noted for #13
2026-11-07 · #05 · done · temp HOME: same output as apply.py (diff -r), second run silent; no apply.py refs (gq-setup a loop commit)
2026-11-07 · #06 · in-progress · opus/medium
2026-11-07 · #06 · decision · new deps named in the PR description, not get-help; environments.md label renamed; files grew (~5.6k CLAUDE.md) · batching + "Who decides" need the lines
2026-11-07 · #06 · done · grep empty in both worktrees; fresh haiku agent answered (a) build+ship, (b) ask Vicky + data-loss-approved, (c) get-help — all correct
2026-11-07 · #07 · in-progress · opus/medium
