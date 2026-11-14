# Loop 11: Office foundation
Orchestrator: opus/medium
## Goal
The app is "GQP Office" and its shell matches Vicky's demo (`docs/mockup/gqp-office-demo.html`) for every role. Roles,
people fields, teams, the per-role access matrix, read-only View as, Google sign-in, file storage, the A4 print layout,
EN/BM/中文 support and public holidays are in place, so the parity lanes in `docs/office-parity/roadmap.md` can run
two at a time without touching the same files. Everything account-bound is code or env and listed in
`docs/handover-migration.md`. Merged to `main`.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Keep real sign-in. The demo's "Signed in as" dropdown is a prototype device. MD gets the demo's read-only "View as" (purple banner, "Back to X", every write refused server-side), replacing the current write-capable Sign in as | Owner choice; server-enforced permissions need real identities | Copying the dropdown; MD-only header dropdown |
| D2 | Google sign-in only, through an OAuth client in the owner's own GCP project, External consent screen. Invite-only: Supabase sign-ups stay off and a person must exist in People. The callback checks the email domain against `ALLOWED_EMAIL_DOMAINS` (prod `gqprojects.com.my`). The password and set-password-link flow is removed; the laptop dev role panel stays | Owner choice; Vicky asked for Workspace login | Keeping passwords; GCP in Vicky's org now (blocks on her) |
| D3 | Uploaded files go to Supabase Storage, private buckets, images downscaled on upload. Site photos and videos stay as Drive links, as in the demo | Same permission model as records, no new account | Google Drive API; links only |
| D4 | Print and PDF use one shared A4 print layout with print CSS; "Download PDF" in the demo becomes Print (Save as PDF) | No dependency; the demo's forms already print this way | jsPDF / html2canvas, server PDF rendering |
| D5 | Access matrix gates pages (nav and server route checks) and the "See margin % and cost" flag. Data RLS stays role-based plus team scoping | Matches the demo's matrix; avoids rewriting every policy per override | Matrix-driven RLS |
| D6 | Teams: a salesperson reports to a director or BD (`reports_to`). Directors and BD see their own team's sales records; md and accounts see all; operations roles (site, support, ssup) keep what they read today | Demo `myTeam`/`inTeam` rules | Directors see everything (old app) |
| D7 | All 21 demo pages are registered once in this loop (key, labels per role, icon, default roles, `built`). Unbuilt pages stay hidden. Later loops only flip `built` and add routes | Parallel lanes never edit the same nav entries | Each loop adds its own entries |
| D8 | The new demo replaces `docs/mockup/gq-crm-mockup.html` (git keeps it). App name "GQP Office"; logo extracted from the demo | Single spec; Vicky's naming | Keeping both demos |
| D9 | UI parity is checked per screen and role: demo vs app screenshots side by side in Chrome (profile "Agent"), per `docs/office-parity/parity.md` | Vicky is particular about layout | Eyeballing |
| D10 | i18n: `en`, `bm`, `zh` dictionaries seeded from the demo's `TT` and `ZHEN`, a per-person language, and a toggle component. Shell labels translated now; later loops add their strings | Demo has BM for site screens and 中文 for Costing | No i18n; a heavy i18n library |
| D11 | Demo contradictions: follow the more specific rule and log it. Site supervisors work Mon-Sat (site log reminders Mon-Sat) | Owner: "follow demo" | Asking Vicky each time |
| D12 | Easy move to Vicky's accounts: no project ref, URL or key in code; auth providers, redirect URLs and buckets are config or migrations applied by script/CI; `docs/handover-migration.md` lists every account-bound item with move steps | Owner: everything moves to her Vercel, Supabase and GCP soon | Dashboard-only settings |
| D13 | The executor does dashboard work itself in Chrome (Supabase restore, GCP OAuth client, provider config, reading prod emails). Secrets go only to GitHub secrets / Vercel env / Supabase, never git or logs | Owner consent 2026-11-14; prod is not live | Parking as owner actions |
| D14 | One branch `loop/11-office-foundation` in a worktree, one commit per task, one PR, merged once local and PR checks pass | Same as loops 07-10 | Branch per task |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Restore Supabase + keep-alive that works | done | - | sonnet/high |
| 02 | Demo into repo, logo, app name, parity and handover docs | done | - | sonnet/medium |
| 03 | Roles and people fields | done | - | opus/medium |
| 04 | Team scoping: helpers + customers, activities, projects | done | 03 | opus/medium |
| 05 | Team scoping: MOFs, payments, commission, reports | in-progress | 04 | opus/medium |
| 06 | Page registry + access matrix | todo | 03 | opus/medium |
| 07 | Shell parity | todo | 02, 06 | sonnet/high |
| 08 | Read-only View as | todo | 07 | opus/medium |
| 09 | Google sign-in | todo | 03 | opus/medium |
| 10 | Storage foundation | todo | 03 | sonnet/high |
| 11 | A4 print layout | todo | 07 | sonnet/medium |
| 12 | i18n EN/BM/中文 | todo | 03, 07 | sonnet/high |
| 13 | Public holidays + workdays | todo | - | sonnet/high |
| 14 | Dev seed: demo people as test personas | todo | 03, 04, 06 | sonnet/medium |
| 15 | Final checks, shell parity pass, docs, merge | todo | 01-14 | sonnet/medium |
## Owner actions
- Tell Vicky to pause her own changes until loop 11 is merged (the shell and roles change under her). Message to a
  person, so the owner sends it.
- At handover: move the GCP project into Vicky's Google Workspace org, following `docs/handover-migration.md`.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-14 · plan · loop written from the drift analysis in docs/office-parity/ · next: #01
2026-11-14 · #01 · started (sonnet/high) · planner tab w7:t9 closed
2026-11-14 · #01 · decision · keep-alive pings each project's REST API (profiles, publishable key from new GH secrets SUPABASE_{DEV,PROD}_PUBLISHABLE_KEY), Mon+Thu · db query via management API likely didn't count as activity
2026-11-14 · #01 · done · dev resumed, prod healthy, health.yml run 43586779470 success · next: #02
2026-11-14 · #02 · started (sonnet/medium)
2026-11-14 · #02 · decision · parity.md worked example is the demo-side run; app-side run deferred to #14/#15 (laptop dev panel needs the test copy connected) · added data-tile-label hook to StatTile
2026-11-14 · #02 · done · check/typecheck/test pass, old mockup removed · next: #03
2026-11-14 · #03 · started (opus/medium)
2026-11-14 · #03 · decision · migration guard allows `drop constraint X` only when the same statement re-adds X (widening a check keeps every row)
2026-11-14 · #03 · decision · left people: restrictive "left people: no access" RLS policy on every table; /left route signs them out · new tables must add it (docs/decisions.md)
2026-11-14 · #03 · decision · Profile type not extended yet; tasks 06/12 add sees_margin/language as needed · marketing/designer cannot add companies/contacts
2026-11-14 · #03 · done · check/typecheck/test (1093)/guard pass · next: #04
2026-11-14 · #04 · started (opus/medium)
2026-11-14 · #04 · decision · SQL my_team()/in_my_team(); salesperson without reports_to is in no team (only md/accounts see); left salespeople stay in lead's team; created_by counts as team ownership (insert-returning needs it)
2026-11-14 · #04 · decision · read policies changed via alter policy (guard refuses drop policy); edit/insert policies untouched; contact_owners stays read-all
2026-11-14 · #04 · done · check/typecheck/test (1125)/guard pass · next: #05
2026-11-14 · #05 · started (opus/medium)
