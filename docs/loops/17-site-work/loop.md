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
| 02 | Site log rules | in-progress | 01 | opus/medium |
| 03 | Log work home | todo | 02 | sonnet/high |
| 04 | Log work wizard | todo | 02 | sonnet/high |
| 05 | Follow-ups: owner, still waiting, snooze | todo | 01 | sonnet/high |
| 06 | Site Work: Jobs + Site log tabs | todo | 02 | sonnet/high |
| 07 | Site Work: Measurements + Photos & videos | todo | 01 | sonnet/high |
| 08 | Site Work: Actions, Stock returns, Daily log | todo | 05 | sonnet/high |
| 09 | Site nav, BM strings, dev seed | todo | 03, 04, 06, 07, 08 | sonnet/medium |
| 10 | Parity pass, docs, merge | todo | 01-09 | sonnet/medium |
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
