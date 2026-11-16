# Loop 22 rehearsal (task 09), 2026-11-16

## Setup
- Every run took place in throwaway clones under the session scratch dir, with a temp `HOME` and `gh` signed in as the
  owner through `GH_TOKEN` (standing in for her accepted invite). The real checkout and its stamp were never touched.
- `origin` in each clone was a local bare mirror of GitHub with `loop/22-handoff` (1113a21) pushed into it, so archive
  tags never reached GitHub. Side effect: `gh issue list` cannot resolve that origin, so the hooks' issue injection
  was not exercised here (`session-sync.test.ts` covers it).
- The database steps ran against the real test copy (`gq-crm-dev`), the same as on her laptop.
- Mac only (Node 24.19, pnpm 12.16.1). Windows is still untested (`docs/debt.md`).

## Scenarios
| # | State | Result |
|---|---|---|
| 1 | `main` at `a8ddcaa`, clean, no `.env.local`, worktree `.claude/worktrees/old-quote-tweak` on a pre-parity branch with one commit and one uncommitted file | Pass |
| 2 | Recent main (loop tip), `.env.local` already present | Pass |
| 3 | Second session straight after 2 | Pass |
| 4 | Keys missing (a `gh` shim pointed the fetch at `crm/.env.wrong-path`, real 404) | Pass after fix |

1. The old hook (`a8ddcaa` version) pulled `main` to 132f454 on its own. Pulling the loop branch, the new hook then
   printed "Laptop update due". The first `pnpm catch-up` took 34 s, exited 0 and printed the "up to date" line, the
   archive line and What's new. `.env.local` was created with mode 600. Tag `archive/pre-parity/old-quote-tweak` exists
   locally and on the mirror; it holds the draft commit plus "chore: save draft before archive" with the
   uncommitted file. The worktree and branch are gone and `main` is clean. With `pnpm dev`, the Sign in as panel
   listed 15 people (17 sign-ins, 2 have left, as `docs/laptop.md` says). Signing in as Awal (Site Supervisor, the
   nearest to an installer) opened Log work; signing in as Vicky opened the Team dashboard with the full menu.
   The log holds no key values.
2. The first run in a new clone with keys present installed and seeded in 22 s, exit 0. The second run printed
   nothing, exit 0, in 0.13 s.
3. The new hook, the throttled hook and `pnpm --silent catch-up` all printed nothing, exit 0.
4. The line read "Your laptop is only partly up to date. I could not get the test copy keys, bring the test copy up
   to date, refresh the example records and test sign-ins. Claude will sort it out.", exit 1. The log gives the
   reason. Playbook situation 10 points to `connect-test-copy`. Once the shim was removed, the next run fetched the
   keys and finished, exit 0, and the run after that was silent.

## Gaps found and fixed
- **`pnpm -s` is not silent in pnpm 12.16.1.** It echoes `$ node scripts/agent/catch-up.mjs` to stderr on every run,
  so the "silent when nothing changed" promise broke. On the first run in a folder without `node_modules`, pnpm's
  own pre-run install also printed about 60 lines. `pnpm --silent catch-up` hides both. Changes: CLAUDE.md,
  the preview skill and `docs/laptop.md` now say `pnpm --silent catch-up`, and so does the hook's "Laptop update
  due" line (plus its test). `.claude/settings.json` allows `Bash(pnpm --silent catch-up)` because the existing
  `pnpm catch-up *` rule does not match the flag before the script. The playbook explains why the flag matters and what
  a non-zero exit with no line means (pnpm's first install failed before catch-up started).
- **The key failure line said something untrue.** It read "this GitHub account has no access yet; Tong Sheng needs to
  send an invite", but the invite is already sent, and a missing file or a signed-out `gh` gave the same line. It
  now reads "get the test copy keys", matching the playbook table. The reason stays in the log, and situation 10 now
  sends her Claude there.

## Seen, not fixed (out of scope)
- `docs/whats-new.md` still has the old November text. Task 10 rewrites it.
- Next dev overlay "1 Issue": React warns about the `<script>` in `src/components/app/theme-script.tsx`. This happens
  before this loop and is harmless.
- Ordering risk: her old CLAUDE.md starts ship-queue at session start, and that ship-queue may merge `main` into a
  pre-parity draft before catch-up archives it. The bootstrap issue asks for it to run before the tidy-up, and the
  archive still tags whatever the branch holds, so no work is lost.
- The old CLAUDE.md sends each `for:vicky-claude` issue to a subagent in its own worktree with deploy.
  `assets/bootstrap-issue.md` overrides this explicitly: main folder, no subagent, no build or deploy.
