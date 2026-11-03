# Loop 08: README and features doc with screenshots
Orchestrator: sonnet/high
## Goal
README is a current developer/agent entry point with a short demo GIF at the top. `docs/features.md` shows every
app screen with a screenshot, what it does and who uses it. Docs only; merged to main.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | README audience: developers + agents. What the app is, stack, local setup, scripts, folder map, links into `docs/` (incl. features.md) | Vicky's guide already lives in the in-app Guide | Vicky-facing README; two-audience README |
| D2 | `docs/features.md`: one section per screen (what it does, who uses it, screenshot). Images in `docs/screenshots/<screen>.jpg` | Keeps README short; one place to refresh | FEATURES.md at root |
| D3 | Capture with Claude in Chrome on `pnpm dev` (test copy, seeded example records). Resize window to 1440x900 first; `computer screenshot` with `save_to_disk: true`, `scale: 1` (saved size follows scale); copy the returned temp path into `docs/screenshots/`. Keep JPEG | Owner choice; verified 2026-11-03 that save_to_disk writes a file | Playwright devDependency; owner by hand |
| D4 | Signed in as director (`SMOKE_DIRECTOR_*` in `.env.smoke.local`), one image per screen. Screens the director can't open use `SMOKE_MD_*`. Role differences described in text only | Director sees nearly everything with full data | Per-role images |
| D5 | README demo: GIF ~15-20 s (sign in, Dashboard, Customers, MOF Register, Sales Calendar) via `gif_creator`, overlays and watermark off, `download: true`, moved from `~/Downloads` to `docs/screenshots/demo.gif`; under ~10 MB | GitHub renders GIFs inline; committed mp4 doesn't play in README | mp4; no clip |
| D6 | Branch `loop/08-readme-features` in a worktree, one commit per task, one PR; merge pre-approved once checks pass. If auto mode denies the merge, park it as an owner action | Same as loop 05/07 | Commit to main |
| D7 | Screenshots show only seeded example records; never sign-in pages with typed passwords visible | No real or secret data in repo | - |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Rewrite README | done | - | sonnet/medium |
| 02 | Screenshots + docs/features.md | blocked: owner — 4 MD-only images missing (mofs, mofs-detail, commission-settings, people); allow reading SMOKE_MD_* or sign in as MD at localhost:3000 | - | sonnet/high |
| 03 | README demo GIF | in-progress | 01 | sonnet/medium |
| 04 | Final checks, links, PR, merge | todo | 01, 02, 03 | haiku/low |
## Owner actions
- None expected. `.env.smoke.local` exists in the main checkout; copy it into the worktree (gitignored).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-03 · plan · loop written · /execute-loop
2026-11-03 · #01 · in-progress · delegated to sonnet/medium
2026-11-03 · planner · closed w5:t0 after planner answered YES · -
2026-11-03 · #01 · done · README 74 lines, pnpm check ok, links ok except features.md (task 02)
2026-11-03 · #01 · decision · roles line "admin manages people and settings / staff day-to-day" is a guess from CLAUDE.md; docs/desktop-findings.md linked · low risk
2026-11-03 · #02 · in-progress · delegated to sonnet/high
2026-11-03 · #02 · blocked: owner · auto-mode classifier denied reading SMOKE_DIRECTOR_*/MD_* from .env.smoke.local (credential materialization); no files changed, dev server and tab closed
2026-11-03 · #02 · note · viewport looked ~500x667 after resize_window; recheck it is 1440 wide before capture. /mofs needs MD (director not allowed). Sidebar order and role guards are in src/lib/auth/nav-sections.ts
2026-11-03 · #03 · blocked: owner · needs the same signed-in session as #02
2026-11-03 · #04 · skipped · depends on 02, 03
2026-11-03 · vault · ~/work/vault/sessions/gq-projects-crm/2026-11-03-loop-08-readme-features.md
2026-11-03 · merge · README + loop log merged to main early at owner's request (owner pushed); branch and worktree kept for #02-#04
2026-11-03 · #02 · in-progress · resumed by owner; retry delegated to sonnet/high (check state first)
2026-11-03 · #02 · blocked: owner · retry denied again by auto-mode classifier (credential materialization) before the subagent started; no sign-in permission or session was set up
2026-11-03 · #02 · in-progress · owner granted the retry call; delegated to sonnet/high
2026-11-03 · #02 · partial · 18 of 22 screens captured as director (1440 wide, pnpm check ok), features.md written with all 22 sections; 4 MD-only screens lack images (mofs, mofs-detail, commission-settings, people); classifier denied SMOKE_MD_* read
2026-11-03 · #02 · decision · reports-director.jpg shows the director's notice view (real report needs MD/BD Director/Accounts); viewport is 1440x723 not 900 (browser chrome); Next.js dev badge visible bottom-left in shots
2026-11-03 · #03 · in-progress · director session already signed in on localhost:3000, so no credentials needed
2026-11-03 · #03 · decision · MOF Register is MD-only, so the clip uses Dashboard, Customers (open one), Projects, Sales Calendar instead · director can open all of them
