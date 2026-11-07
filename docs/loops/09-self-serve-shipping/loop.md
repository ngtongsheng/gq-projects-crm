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
| 07 | Session-sync hook and remote instructions | done | 06 | opus/medium |
| 08 | Ship-queue skill | done | 06 | sonnet/high |
| 09 | Test-copy kit (connect, db:test-copy, test sign-ins) | done | 04 | sonnet/high |
| 10 | help-bundle and get-help attachment | done | 05 | sonnet/high |
| 11 | Consolidate and ship PRs 21-31 | done (31 left open: owner) | 01, 02, 06 | opus/medium |
| 12 | Docs and plain note for Vicky | done | 01-11, 13 | sonnet/high |
| 13 | Windows path in SETUP.md | done | 05 | opus/medium |

## Owner actions
- Rollout (after the loop merges): tell Vicky "Open a new chat, say *get the latest CRM*, then close it and open
  another." First session pulls; rules, skills and hooks load from the second session on.
- Dev DB password: if lost, reset it in the `gq-crm-dev` dashboard, then `gh secret set SUPABASE_DEV_DB_PASSWORD`.
- After #09: send Vicky the dev secret key and dev DB password privately (WhatsApp), never in git or issues. First, on your Mac in the main checkout: `pnpm connect:test-copy` (paste both values), then `pnpm db:test-copy` (expect "up to date") and `pnpm reset:sign-ins` (expect 7 sign-ins).
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
2026-11-07 · #07 · decision · removed CLAUDE.md "git pull at session start" (hook does it); from:crm comments via one `gh issue list --json comments` · fewer calls in the 20 s budget
2026-11-07 · #07 · fix · dropped `gh issue list --author` (search API lags on new issues); author enforced by the tested filter
2026-11-07 · #07 · done · 22 unit tests pass; manual: prints owner issue, throttled 2nd run silent; real sessions: SessionStart:startup injected (#37) and SessionStart:resume fired (#34). Test issues 33-37 closed
2026-11-07 · #07 · note · a haiku agent primed with a suspicious prompt treated hook text as untrusted; Vicky's sessions untested for this · watch the first real for:vicky-claude issue
2026-11-07 · #08 · in-progress · sonnet/high
2026-11-07 · #08 · decision · ship-queue updates waiting branches by `git merge origin/main` + plain push, not rebase + force-with-lease; settings.json deny rules unchanged · subagent's deny-rule loosening was blocked by the classifier; squash merges make branch history irrelevant and plain pushes can't lose remote work
2026-11-07 · #08 · decision · deploy writes `<!-- vicky-approved -->` PR comment as the approval marker ship-queue reads
2026-11-07 · #08 · done · dry-run on real repo lists chain 21→25→27→{23,31}, 29 on 23, 28 standalone (read-only); stack test done in a local scratch repo (squash A, merge trunk into B → PR diff = B only) instead of throwaway GitHub PRs, which would deploy to live
2026-11-07 · #09 · in-progress · sonnet/high
2026-11-07 · #09 · decision · added `pnpm connect:test-copy` (secrets via stdin, verified against dev, writes .env.local 600) and `pnpm copy-env` (cross-platform worktree copy) · keeps secrets off the command line; Windows-safe
2026-11-07 · #09 · decision · marked done with 2 live-secret checks moved to owner actions (`pnpm db:test-copy` "up to date", `pnpm reset:sign-ins` 7 rows) · code + guards fully tested; dev secrets not on this machine; blocking would hold the whole loop
2026-11-07 · #09 · done · check/typecheck/test (972) pass; prod-ref refusal exits 1 before connecting; copy-env verified in a fresh worktree; .env.local ignored
2026-11-07 · #10 · in-progress · sonnet/high
2026-11-07 · #10 · decision · whole help report kept < 60,000 chars (transcript shrinks first), stdout bundle ≤ 45,000 · GitHub issue body limit is 65,536
2026-11-07 · #10 · done · 12 node tests pass (redaction fixture, caps, budget); real run 8.1 s, both sections, secret-pattern scan clean (gq-setup commit)
2026-11-07 · #11 · in-progress · opus/medium
2026-11-07 · #11 · decision · land 01-10 on main via a PR (`gh pr merge`, no --admin) before #11; update stacked branches by merging origin/main + plain push, not rebase/force · project denies `git push *:main*` and force pushes; #11 needs the guard fix and pre-migration backup on main
2026-11-07 · #11 · blocked · `git push -u origin loop/09-self-serve-shipping` denied twice by auto-mode classifier ("Code That Leaks When Run"); not worked around · owner decides
2026-11-07 · #13 · in-progress · opus/medium (gq-setup worktree)
2026-11-07 · #13 · decision · gh and node via `mise use -g` on both OSes; mise via official PowerShell script; shims on user Path (no PS profile); rtk skipped on Windows · shared steps, stable shim path, no script-policy issues
2026-11-07 · #13 · done · two fresh agents read SETUP.md as win32: commands per step are OS-labelled, no unlabelled Mac-only command on Windows, none Windows-only on Mac; credential helper `$HOME` expands at run time (git runs `!` helpers via sh). Real Windows run = owner action (gq-setup commit)
2026-11-07 · vault · ~/work/vault/sessions/gq-projects-crm/2026-11-07-loop-09-self-serve-shipping.md
2026-11-07 · #11 · unblocked · owner added a push allow rule; both loop branches pushed; PR #38 lands 01-10 on main
2026-11-07 · #11 · decision · narrow allows for her push/PR commands (`git push -u origin HEAD`, `git push origin HEAD:*`, `gh pr merge/create/edit *`); deploy: any refused step → get-help, never a command for her · auto mode ignores broad `Bash(git *)` and the classifier may refuse pushes; deny rules for main/force/--admin still win
2026-11-07 · #02/#03 · post-merge · data-loss-approved label created; backup.yml run green, artifact prod-backup 26 KB; health.yml green; simulate_failure opened #39 assigned to owner (closed). owner-approved label kept until #11 PRs merge
2026-11-07 · #11 · decision · refused push → deploy writes `vicky-approved-<branch>` marker in git dir + get-help; owner adds an allow rule on main; next session pulls it and ship-queue reruns deploy · she never types a command; approval survives without a PR
2026-11-07 · #11 · in-progress · opus/medium
2026-11-07 · #11 · done · merged 21, 28, 25, 27, 23, 29 (squash, merge-main + plain push, no force); migrate-prod 42365403990, 42365931102, 42366343488, 42366747685 success (dump first); live 307; issues 22/24/26/32 closed
2026-11-07 · #11 · decision · merged 21/25/27/23 with red migrate-dev · dev already had 120000-130000 + 150000-190000 from PRs 30/31, so `db push` refuses; 110000-130000 already ran on dev; 140000 checked by hand, no data deleted, prod dumped first, applied cleanly
2026-11-07 · #11 · decision · PR 31 left open (draft) · its 5 migrations (150000-190000) have no screens on any branch; 150000 rewrites decide_ownership_request on live
2026-11-07 · #11 · owner · decide PR 31 + dev history drift: migrate-dev fails on every future migration PR until dev matches main (ship 31, or `supabase migration repair --status reverted` 150000-190000 on dev + drop those objects)
2026-11-07 · #12 · in-progress · sonnet/high
2026-11-07 · #12 · done · environments/decisions/debt/onboarding updated, plain note docs/whats-new-2026-11.md (file only, not sent); no owner-approved outside loops; pnpm check clean
