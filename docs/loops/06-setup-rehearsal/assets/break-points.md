# Suspected break points (planning review, 2026-11-03)

Ranked by likelihood. "Untested" = loop 02 #04 dry run skipped it because the owner's account already had it.

| # | Setup step | Risk | Evidence / why suspected |
|---|---|---|---|
| B1 | 14 hand-off → first preview | Preview pane starts `pnpm` from `.claude/launch.json` (`runtimeExecutable: "pnpm"`). Desktop launched from the Dock may not have the mise shims on PATH (only `~/.zprofile` / `~/.zshrc` set them) → "pnpm not found" | Desktop findings row 5 passed on owner's Mac, where tools resolve via owner's own profile |
| B2 | first preview sign-in | No login for her on `gq-crm-dev`; Supabase Free pauses after 7 idle days → sign-in fails | docs/debt.md; environments.md "Seeding the first admins" |
| B3 | 6 GitHub sign-in | `gh auth login --web` in background: does Desktop surface the `XXXX-XXXX` code from background output; does gh wait for Enter without a TTY; does `--clipboard` work | Loop 02 #03 note "#04 must verify"; skipped in #04 |
| B4 | 1 Apple tools | Needs an admin account; company-managed Mac may block; 30+ min on slow wifi | Not testable in rehearsal (CLT system-wide); covered by #01 preflight + runbook |
| B5 | 10 tools | Node 24 minimum macOS version; older Mac fails at `mise install` | Verify the real minimum in Node 24 release notes / nodejs.org |
| B6 | whole session | Claude Pro usage cap with Opus default during ~50 min setup + first change | gq-setup agent/settings.json `model: opus` (kept, D4) |
| B7 | 3, 4 tools | `mise use -g gh` / `rtk` download from GitHub unauthenticated; shared wifi can hit rate limit; `rtk` fresh install never run | Skipped in #04 |
| B8 | 7 access | Invite needs her exact username; owner must have `gh` ready live; invites expire after 7 days | onboarding.md section 1 |
| B9 | after day one | New GitHub accounts must enable 2FA within ~45 days of first contribution, else locked out of pushes | GitHub 2FA requirement for contributors |
| B10 | 12 Chat profile | Settings labels (**Profile** / **Your Claude**) unverified | SETUP.md step 12 hedges both |
| B11 | 11 apply | SessionStart hook runs `apply.py` on every session; if `~/.claude/settings.json` already exists from Desktop it is merged; check no warning lines | apply.py merge path not exercised on a fresh Desktop profile |
| B12 | hand-off | First change: CLAUDE.md enters a worktree; worktree has no `node_modules` → preview skill runs `pnpm install` (time, prompts) | preview skill step 1 |
