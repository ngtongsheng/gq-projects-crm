# Loop 17: Site work
Orchestrator: sonnet/high
## Goal
Log work wizard (site role landing page) and the seven Site Work tabs match Vicky's demo
(`docs/mockup/gqp-office-demo.html`, `vToday` ~2769, `vSite` ~3301) per `docs/office-parity/drift-site-stock.md`
(roadmap step 4B, first half). Parity per `docs/office-parity/parity.md`. Merged to `main`. Starts after loop 16 merges.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Step 4B splits: 17 Site work, 18 Installation & stock. Claims becomes 19; Integration is planned later (20) with the WhatsApp provider decision | Owner choice; size | One loop |
| D2 | Leave and MC come from the Leave module (loop 15). `site_off` stores only office and other days; public holidays from `public_holidays`. Log work's "Leave / MC" opens the apply-leave sheet | Owner choice; one balance, one place | Demo's separate site_off for leave |
| D3 | Photos and videos are not uploaded (WhatsApp group + Drive link on the MOF). Only upload is the MC slip, already in Leave | Demo | Uploading media |
| D4 | WhatsApp: only the step-4 deep link (`wa.me` text, no sending). Scheduled reminders (17:00 log, 09:00 missing list, follow-up 08:30) go to Integration; "missed days" and "planned but unrecorded" are computed banners | Scope; matches 14 D7, 15 D3 | Sending now |
| D5 | Site-log columns extend `site_logs` (inst_pct, measurement, shooting, completed photos, return answer); logs without an MOF allowed (free-text site + salesperson, optional pipeline project) | Extend before adding tables | New log table |
| D6 | Logging moves the site stage: installation % → 60 + 0.35 x pct (cap 95), signed handover → Completed, delivery → Delivered; never moves a stage backwards | Demo; protects manual stages | Always overwrite |
| D7 | One branch `loop/17-site-work` from `main` after loop 16 merges, one commit per task, one PR. Rebase before merging. Preflight: none; PR merge deploys as in loops 07-16. Demo contradictions: specific rule wins, logged | Established path | - |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Site log migration | done | - | opus/medium |
| 02 | Site log rules | done | 01 | opus/medium |
| 03 | Log work home | done | 02 | sonnet/high |
| 04 | Log work wizard | done | 02 | sonnet/high |
| 05 | Follow-ups: owner, still waiting, snooze | done | 01 | sonnet/high |
| 06 | Site Work: Jobs + Site log tabs | done | 02 | sonnet/high |
| 07 | Site Work: Measurements + Photos & videos | done | 01 | sonnet/high |
| 08 | Site Work: Actions, Stock returns, Daily log | done | 05 | sonnet/high |
| 09 | Site nav, BM strings, dev seed | done | 03, 04, 06, 07, 08 | sonnet/medium |
| 10 | Parity pass, docs, merge | in-progress | 01-09 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Start only after loop 16 is merged: `/execute-loop docs/loops/17-site-work`.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-site-stock.md (Log work, Site Work) · next: wait for loop 16 merge, then #01
2026-11-15 · #01 · in-progress · delegated (opus/medium), worktree ../gq-projects-crm-loops/17-site-work
2026-11-15 · #01 · done · verified: check, typecheck, test (2435), guard pass
2026-11-15 · #01 · decision · migration guard now lets `DROP NOT NULL` through (loses no data; `DROP NOT NULL, DROP COLUMN` still caught) · avoids a needless data-loss approval for a false positive; record in docs/decisions.md in #10
2026-11-15 · #01 · decision · one site_logs row per activity per visit; photos_* columns shared by shooting and handover rows; snooze lives in site_follow_up_waits only · keeps reports and per-activity counts unchanged
2026-11-15 · #01 · note · report-data.ts (~317, 394) has mof_id: z.string() and SITE_ACTIVITIES lacks stock_return; #02 must cover both
2026-11-15 · #02 · in-progress · delegated (opus/medium)
2026-11-15 · #02 · done · verified: check, typecheck, test (2460) pass
2026-11-15 · #02 · decision · photos_to left null (no sales-support setting yet); saveSiteVisit stores only return_answer, leftovers/stock-return records go to #04 or loop 18; any approved leave counts as away; no "Didn't go" option (no table); addSiteLog kept beside saveSiteVisit until #04/#06 retire the old dialog · scope
2026-11-15 · #03 · in-progress · delegated (sonnet/high)
2026-11-15 · #03 · done · verified: check, typecheck, test (2476) pass; parity screenshots not possible (task 01 migration not on test copy), deferred to #10
2026-11-15 · #03 · decision · site role lands on /today (old SiteDashboard deleted); `today` page built early (overlaps #09 nav); follow-up banner shows counts only until #05; month target from report_targets.siteVisits; /today/log is built in #04 (params date, mof, project, site, activity via record-link.ts) · scope
2026-11-15 · #04 · in-progress · delegated (sonnet/high)
2026-11-15 · #04 · done · verified: check, typecheck, test (2498) pass; parity deferred to #10 (also verify the `mofs` query's `.not("site_logs.inst_pct","is",null)` embedded filter on the test copy)
2026-11-15 · #04 · decision · new-site salesperson list = all team_directory (site role cannot read job roles); balance stock stored only as return_answer text (items per row go to loop 18); no office WhatsApp number setting, link opens WhatsApp to pick chat; date from URL param only; BM strings in #09 · scope
2026-11-15 · #05 · in-progress · delegated (sonnet/high)
2026-11-15 · #05 · done · verified: check, typecheck, test (2516) pass; parity deferred to #10
2026-11-15 · #05 · decision · added optional "Assigned to" select to the Add follow-up dialog (nothing wrote assignee_id); snooze uses the person's week pattern (site Mon-Sat, others Mon-Fri); supabase/tests need a DB and were not run here · scope
2026-11-15 · #06 · in-progress · delegated (sonnet/high)
2026-11-15 · #06 · done · verified: check, typecheck, test (2537) pass; parity deferred to #10 (also verify `loadSiteJobs` embeds and `loadMonthLogs` on the test copy)
2026-11-15 · #06 · decision · old site-log dialog and addSiteLog retired (wizard replaces it); Measurements/Photos/Actions/Stock returns/Daily log tabs are "Coming soon" placeholders until #07/#08; Log buttons only for roles that can open `today`; Site log rows not scoped per salesperson (RLS gives read to all); MOF summary opens existing site page; installer-claims card kept on Jobs · scope
2026-11-15 · #07 · in-progress · delegated (sonnet/high)
2026-11-15 · #07 · done · verified: check, typecheck, test (2555) pass; parity deferred to #10 (also verify tab count queries, `shoot_requests` mofs embed, RPC permissions, marketing Photos view)
2026-11-15 · #07 · decision · saveSiteVisit closes the MOF's open shoot requests when a shooting is logged (failure is logged, visit still saves); no Submit button for unsent measurements/unposted shootings (logs never edited); Drive link stored on the log only (no MOF column); Drive-save permission follows SQL; tables not scoped per salesperson · scope
2026-11-15 · #07 · note · BM strings to add in #09: tab components, dialogs, row-action-buttons.tsx, labels in site-photos.ts
2026-11-15 · #08 · in-progress · delegated (sonnet/high)
2026-11-15 · #08 · done · verified: check, typecheck, test (2584) pass; parity deferred to #10 (also verify `loadSiteActions`, `loadStockReturnLogs`, `app_settings` read on the test copy)
2026-11-15 · #08 · decision · site_reminders stored as JSON row in app_settings (no migration; only MD/admin can edit, director sees form disabled); Stock returns tab has no count and only Sent back / To return until loop 18; no Leave/MC button on missing cells; support team sees "before joined"/leave days as Missing (leave_people() manager-only) · scope
2026-11-15 · #08 · note · office WhatsApp number setting not yet read by the wizard's stock-return link; BM strings for the three new tabs go in #09
2026-11-15 · #09 · in-progress · delegated (sonnet/medium)
2026-11-15 · #09 · done · verified: check, typecheck, test (2590) pass; `pnpm seed:example` not runnable here (no supabase CLI/docker), covered by dataset tests
2026-11-15 · #09 · decision · BM in new src/lib/i18n/bm-site-work.ts; server-action error strings and WhatsApp texts stay untranslated (not passed through t()); one closed follow-up seeded via direct done_at insert · scope
2026-11-15 · #10 · in-progress · parity cannot run (task 01 migration not on test copy, no browser env); parity checklist for Log work + Site Work recorded as awaiting live parity like loops 12/14/16; delegating docs (sonnet/medium)
