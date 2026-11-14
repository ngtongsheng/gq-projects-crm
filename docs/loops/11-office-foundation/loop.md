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
| 05 | Team scoping: MOFs, payments, commission, reports | done | 04 | opus/medium |
| 06 | Page registry + access matrix | done | 03 | opus/medium |
| 07 | Shell parity | done | 02, 06 | sonnet/high |
| 08 | Read-only View as | done | 07 | opus/medium |
| 09 | Google sign-in | done | 03 | opus/medium |
| 10 | Storage foundation | done | 03 | sonnet/high |
| 11 | A4 print layout | done | 07 | sonnet/medium |
| 12 | i18n EN/BM/中文 | done | 03, 07 | sonnet/high |
| 13 | Public holidays + workdays | done | - | sonnet/high |
| 14 | Dev seed: demo people as test personas | done | 03, 04, 06 | sonnet/medium |
| 15 | Final checks, shell parity pass, docs, merge | done | 01-14 | sonnet/medium |
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
2026-11-14 · #05 · decision · bd with a team reads team payments/payouts/commission/sales reports (D6, demo isMgr); Commission/Team Reports pages still isManager-gated until #06
2026-11-14 · #05 · decision · pages load team via rpc("my_team") (src/lib/auth/my-team.ts), staff can't read other profiles; mof_lines stay open (no money columns)
2026-11-14 · #05 · done · check/typecheck/test (1164)/guard pass · next: #06
2026-11-14 · #06 · started (opus/medium)
2026-11-14 · #06 · decision · defaults follow demo ACCESS0: salespeople lose My Sales/MOFs, Purchasing loses Overtime (md can re-tick in the matrix) · D11 follow demo
2026-11-14 · #06 · decision · Sales Performance registered not built (staff can't read other profiles); /performance stays admin; Team Reports managers only; / stays requireRole("staff"); /overtime = Claims; /guide outside matrix
2026-11-14 · #06 · decision · People-matrix parity screenshot deferred to #15 (needs test copy on laptop, same as #02)
2026-11-14 · #06 · done · check/typecheck/test (1193)/guard pass · next: #07
2026-11-14 · #07 · started (sonnet/high)
2026-11-14 · #07 · decision · module tabs removed, one demo sidebar from the registry (sidebar-items.ts); Ownership requests nav link dropped (demo has none; reachable via dashboard attention panel + Dashboard badge)
2026-11-14 · #07 · decision · sidebar outline matched to demo for 6 roles via test + Chrome DOM; md screenshots demo vs fixture-rendered shell; signed-in screenshots for other roles deferred to #15 (test copy)
2026-11-14 · #07 · done · check/typecheck/test (1205) pass · next: #08
2026-11-14 · #08 · started (opus/medium)
2026-11-14 · #08 · decision · View as = real session + viewOnlyFetch guard on server/admin Supabase clients (non-GET refused, allowlist READ_ONLY_FUNCTIONS); expired/altered cookie stays read-only and Back signs out
2026-11-14 · #08 · decision · no per-action "View only – not saved." toast (banner states it); eye icon not emoji · #10 must allowlist storage createSignedUrl POSTs
2026-11-14 · #08 · decision · #15 must verify one real View as round trip on the test copy (Back to MD relies on Next 16 cookie delete being visible in the same action; unverified, fails safe to sign-out)
2026-11-14 · #08 · done · check/typecheck/test (1219) pass · next: #09
2026-11-14 · #09 · started (opus/medium)
2026-11-14 · #09 · decision · auth config via Management API script + manual auth-config.yml (config push would need refs in config.toml, D12); Vercel ALLOWED_EMAIL_DOMAINS set (prod gqprojects.com.my; preview/dev + example.invalid); "New link" removed
2026-11-14 · #09 · decision · src/lib/supabase/test-copy.ts hard-codes DEV/PROD refs (pre-existing laptop guard) · decide in #15
2026-11-14 · #09 · code committed, check/typecheck/test pass (test needs --maxWorkers=2 under load ~18) · blocked: owner — GCP "Verify it's you" in Chrome profile Agent; reading prod auth.users denied by classifier · next: #10
2026-11-14 · #10 · started (sonnet/high)
2026-11-14 · #10 · decision · private `attachments` bucket (1.5 MB, jpeg/png/webp/pdf), insert own path `<area>/<uuid>/<file>` only, no select policy: reads via server signed links (300 s, admin client after record check); View as allows only /object/sign POSTs
2026-11-14 · #10 · decision · #15 must run one real upload round trip on the test copy (owner_id set by signed upload is assumed, PGlite stub only)
2026-11-14 · #10 · done · check/typecheck/test (1271)/guard pass · next: #11
2026-11-14 · #11 · started (sonnet/medium)
2026-11-14 · #11 · decision · PrintLayout + PrintSignatureRow, @page A4 10mm, shell hidden via data-slot print CSS; print-preview screenshot deferred to #15 (/dev/components needs sign-in → test copy)
2026-11-14 · #11 · done · check/typecheck/test (1271) pass · next: #12
2026-11-14 · #12 · started (sonnet/high)
2026-11-14 · #12 · decision · src/lib/i18n (t(), bm from TT, zh = inverted ZHEN); labels translated server-side in sidebarItemsFor; toggle sets cookie only (separate session cookie during View as); toggle placed on pages by later loops
2026-11-14 · #12 · done · check/typecheck/test (1278) pass; BM site supervisor sidebar test matches demo · next: #13
2026-11-14 · #13 · started (sonnet/high)
2026-11-14 · #13 · decision · public_holidays seeded with demo's Christmas only (2026, 2027); md/accounts add Malaysian holidays later via Leave screen; workday fns take a required WorkCalendar; manager dashboard + Sales Performance use Mon-Fri
2026-11-14 · #13 · done · check/typecheck/test (1297)/guard pass · next: #14
2026-11-14 · #14 · started (sonnet/medium)
2026-11-14 · #14 · decision · 17 demo people seeded (Vernice/Vanisha → Eddie, Cavan/Crystal → Vanessa; Awal/Akmal BM); old per-role test sign-ins marked inactive; dev panel lists people, refuses non-example.invalid emails
2026-11-14 · #14 · done · check/typecheck/test (1300) pass · seed run + "panel as Eddie" check folded into #15 (needs test copy)
2026-11-14 · #15 · blocked · depends on #09 (owner) and every signed-in check needs the test copy on the laptop. #15 must cover: seed run, Eddie sidebar, signed-in parity screenshots (#02/#06/#07/#08), View as round trip, storage upload round trip, A4 print preview, Google sign-in e2e, test-copy.ts refs decision
2026-11-14 · vault · ~/work/vault/sessions/gq-projects-crm/2026-11-14-loop-11-office-foundation.md
2026-11-14 · #09 · owner passed GCP verification in Chrome · resumed: OAuth client, secrets, dev provider
2026-11-14 · #09 · decision · GCP project goes under the owner's personal Gmail with no organization (owner choice), not the stasheway.com org: a project can't leave an org later; nothing was created in stasheway.com
2026-11-14 · #09 · owner signed personal account into Chrome Agent (authuser=1) · resumed
2026-11-14 · #09 · GCP project gqp-office created (personal gmail, no org); Auth Platform branding steps 1-3 filled · blocked: owner must accept Google API Services User Data Policy
2026-11-15 · #09 · owner accepted policy + created branding · OAuth client "GQP Office" (dev+prod callbacks), GOOGLE_OAUTH_CLIENT_ID/SECRET GH secrets set, Google provider enabled on test copy
2026-11-15 · #09 · decision · consent screen stays in Testing (publish needs home page + privacy policy URL); until then only listed test users can sign in · owner action
2026-11-15 · #09 · done · code + config done; e2e sign-in check folded into #15 with the other test-copy checks
2026-11-15 · #15 · owner connected laptop to test copy (dev DB password reset, GH secret updated) · decision · test copy reset to loop 11 migrations (owner chose option 1); Vicky's PR #31 migrations removed from test copy, still on her branch
2026-11-15 · #15 · fix · seed payouts exceeded payout cap (latent since loop 03); seed data fixed + example-data-seed PGlite test; seed completes on test copy
2026-11-15 · #15 · started (sonnet/medium)
2026-11-15 · #15 · fix · director dashboard crashed (team project's customer unreadable) → migration 20261115100000_team_work_shows_its_customer + test; print CSS white/flush; dev panel hidden in print
2026-11-15 · #15 · decision · unknown Google account sees "You haven't been added yet" (Supabase refuses before callback), domain message only for existing non-domain users; test-copy.ts refs kept as safety-guard exception (decisions.md, handover-migration.md)
2026-11-15 · #15 · done · Eddie/MD/9 roles sidebar + matrix + banner parity at 1280 (390 not done), View as round trip ok, storage round trip ok, A4 one page, check/typecheck/test (1302)/guard/build pass
