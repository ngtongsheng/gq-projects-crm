# 04 Parity: loop 17 Log work, Site Work (2026-11-16)

Test copy `gq-crm-dev`, `pnpm dev` in the worktree, demo on port 3112 ("Reset example data" first), Chrome profile "Agent".

## How it was run
- Legend: **V** compared visually (side-by-side screenshots of the demo and the app) and by structure; **S** structure
  only (snippet or page text read through the same selectors, no screenshot pair); **O** only checked for horizontal
  overflow at 390 px; **-** not run. ✓ matches; ✗ differs. `[LW1]`, `[SW1]` etc. are rows in
  `docs/office-parity/drift-after-sweep.md`; "L21" is a line under "Loop 21" in `docs/decisions.md`; "fixed" was fixed
  in this task.
- 1280: the Chrome window (1280 x 657 viewport, so a screenshot shows one scroll position; long pages were scrolled and
  shot again where marked).
- 390: Chrome will not shrink the window below about 500 px, so each screen was loaded in a 390 px iframe (media queries
  answer to the frame) and both sides were shot that way.
- Persona per job role: site = Awal (EN) and Akmal (BM); site who sells = Sarah; md = Vicky; support = Wai Mun
  (job role `support`) and Jess (job role `ssup`, "Sales support"); bd = Vanessa (extra). **Marketing could not be run:**
  the only marketing person is the vacant "Marketing Exec", who has left, so there is no one to sign in as in the app or
  the demo. The two-tab rule is covered by the `siteViewsFor` unit tests (L21).
- The test copy was changed (a visit logged as Awal on MOF-2026-014, a purchasing action closed as Wai Mun) and put back
  with a re-seed at the end.

## Check first (loop 17 list)
- `loadSiteJobs` embeds and `loadMonthLogs`: Jobs and Site log opened for Vicky, Jess, Wai Mun, Awal, Vanessa and the
  Log work home for Awal, Akmal and Sarah, no server error in the `pnpm dev` output. ✓
- `loadSiteActions` and `loadStockReturnLogs`: Actions needed and Stock returns opened for Vicky, Jess, Wai Mun, Awal.
  ✓
- `app_settings` read for `site_reminders`: Daily log & reminders opened for Vicky with the reminder settings filled. ✓
- `mofs` filter `.not("site_logs.inst_pct","is",null)`: the wizard's MOF list showed "60% installed" for MOF-2026-014
  and, after saving 70%, the Site log, the Jobs row ("Installed 70%") and the visit card showed 70%. ✓
- `shoot_requests` embed on `mofs`: Photos & videos opened (three requests, one open, Cancel for the MD). ✓
- RPC permissions: as Wai Mun (`support`) the Done button shows on the two Purchasing actions only and "Done" worked
  (Actions needed 6 to 5). As Awal (site) the wizard saved a visit (installation 70%, shooting, handover) and the saved
  step and the Log work home showed it ("Recorded", chips). Jess (`ssup`) has no Done buttons at all ([SW3]). ✓ for the
  rule as built, ✗ against the demo.
- Marketing Photos & videos view (two tabs): not reachable (no active marketing person); unit tests only.
- Sticky bottom bar at 390 px against `lwfab`: both have a sticky "Record a site" bar and sticky Back / Next in the
  wizard; the app's bar is full width, the demo's floats ([L21]). ✓
- Bug found and fixed: the wizard page threw "useEffect must not return anything besides a function" (the effect
  returned `window.scrollTo(...)`, which returns a Promise in Chrome 157). Step 1 never opened. Fixed in
  `today/log/wizard.tsx` (fixed).

## Log work (`/today`, `/today/log`)
| Person | Width | Screen | Sidebar | Heading | Banners / tiles | Controls | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|
| Awal (site, EN) | 1280 | Home | ✓ (S) | ✓ | ✗ follow-up banner colour and labels; ✓ missed days; tile ✓ except balance stock line | ✓ Today / Yesterday / Other day; extra "Show" | ✓ Record a site, Leave / MC / office | V ✓ (tile, buttons, planned, recorded) | L21 [LW2] |
| Awal | 1280 | Wizard 1 (site) | - | ✓ step 1 of 3, "Which site?" | - | ✗ job list is 3 lines, no salesperson | ✓ Cancel / Next | V ✓ after fix (tinted pick, 2 cards) | fixed, L21 |
| Awal | 1280 | Wizard 2 (activities) | - | ✓ | - | ✓ 8 activities; ✗ labels "Inspection", "Shooting", "Touch Up" (demo: "Site inspection", "Photo / video shooting", "Touch up") | ✓ Back / Next | V ✓ after fix (4 across, tinted) | fixed, L21 |
| Awal | 1280 | Wizard 3 (details) | - | ✓ | ✓ same six questions, hints, percent grid | ✗ amber outline on unanswered; yes/no in halves | ✓ Back / Save | V ✓ content, ✗ activity chips plain text | L21 |
| Awal | 1280 | Wizard 4 (saved) | - | ✓ | ✓ "This month: N / 50" | - | ✓ Another site / Done | V ✓ after fix (dark Another site, outlined Done) | fixed |
| Awal | 1280 | Away dialog | - | ✗ two steps (Leave or MC / Office / Other) | - | ✗ | - | V ✗ | L21 (loop 17 D2) |
| Awal | 390 | Home | - | ✓ | ✓ | ✓ sticky bar | ✓ | V ✓ no overflow (388) | L21 (floating bar), [SW5] |
| Awal | 390 | Wizard 2 | - | ✓ | - | ✓ 2 columns, sticky Back / Next | ✓ | V ✓ | - |
| Awal | 390 | Wizard 1, 3, 4 | - | - | - | - | - | O ✓ (wizard page, no overflow) | - |
| Akmal (site, BM) | 1280 | Home | ✗ Tasks, Leave were English (fixed: "Tugasan", "Cuti") | ✓ "Rekod kerja hari ini" | ✗ no "Gambar siap belum dihantar" or "Permintaan ambil gambar / video" banner | ✓ | ✓ | V ✓ (BM words match; banners differ) | fixed, [LW1] |
| Akmal | 390 | Home | - | - | - | - | - | - | - |
| Sarah (site who sells) | 1280 | Home | ✓ 13 items incl. My customers, My sales, My collection, My commission (S) | ✓ | ✗ shooting-requested banner missing | ✓ | ✓ | V ✓ shape (language differed: app BM, demo EN) | [LW1] |
| Sarah | 1280 | Wizard 1, new site | - | ✓ | - | ✗ salesperson is a select (demo: chips, no Vicky) | ✓ | V ✓ after fix | L21 |
| Sarah | 390 | Home, wizard, Site Work, Customers, Commission | - | - | - | - | - | O ✓ no overflow | - |

BM wording: compared every demo `TT` entry against the app's BM dictionaries by script. 25 strings differed (the
loop 17 text had been written without them) and were set to the demo's wording (fixed). "Salesperson" and "Purchasing"
now stay English as in the demo.

## Site Work (`/site-work`), md, support, site, bd
Tab columns/buttons were diffed with the `parity.md` snippet in both tabs for every tab listed.
| Person | Width | Tab | Sidebar | Heading | Tiles / filters | Tabs | Columns | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | Jobs | ✓ (S) | ✗ "Site Work" (fixed to "Site work") | ✗ stage counts were pills (fixed to tiles) | ✗ Stock returns has no (N) | ✓ 7 columns | ✓ MOF summary, Log site visit; app adds "Verify work" | V ✓ after fixes (table now fits 1010 px) | fixed, L21 [SW1] |
| Vicky | 1280 | Site log | ✓ | ✓ | ✗ 2 tiles across (fixed to 3); ✗ month select vs arrows | ✓ | ✓ 6 columns, same | ✓ | V ✓ after fixes (table fits) | fixed, L21 |
| Vicky | 1280 | Measurements | ✓ | ✓ | - | ✓ | ✓ 4 columns | ✗ no "Submit" for unsent (known gap) | V ✓ | L21 |
| Vicky | 1280 | Photos & videos | ✓ | ✓ | - | ✓ | ✓ 3 tables, same headers | ✓ Request shooting, Cancel, Saved to Drive | V ✓ after fix (first table fit) | fixed |
| Vicky | 1280 | Actions needed | ✓ | ✓ | ✗ filter "Client" (fixed "Client / main contractor") | ✓ | - | ✗ "Done" + "Still waiting" vs "Mark done" (loop 17) | V ✓ | fixed, L21 |
| Vicky | 1280 | Stock returns | ✓ | ✓ | - | ✗ no count | ✗ 5 columns vs 8 | ✓ Record balance stock (demo) | V ✗ | [SW1] |
| Vicky | 1280 | Daily log & reminders | ✓ | ✓ | ✓ tiles and settings fields equal | ✓ | ✓ day grid | ✗ no Leave / MC on a missing cell (known gap) | V ✓ (app adds a "missing" summary) | L21 |
| Vicky | 1280 | New-MOF banner, MOF summary dialog | - | ✓ | - | - | - | ✓ | V ✓; dialog MOF number wrapped (fixed) | fixed |
| Vicky | 1280 | MOF page `/site-work/[mofId]` | - | ✗ | ✗ demo sheet has tiles, products, payments... | - | - | ✗ | V ✗ | [SW2] |
| Vicky | 390 | Jobs | - | ✓ | ✓ tiles | ✓ tabs wrap | - | ✗ banner button squeezed text (fixed) | V ✓ no overflow | fixed, [SW5] |
| Vicky | 390 | Site log, Daily log | - | ✓ | ✓ | ✓ | - | - | V ✓ stacking, no overflow | [SW5] |
| Vicky | 390 | Measurements, Photos, Actions, Stock returns | - | - | - | - | - | - | O ✓ no overflow | - |
| Wai Mun (support) | 1280 | Actions | app 10 items, demo list not diffed (S) | ✓ | - | ✓ | - | ✗ Done on 2 of 6 (demo: all) | S | [SW3] |
| Wai Mun | 1280 | Other tabs, 390 | - | - | - | - | - | - | - | - |
| Jess (`ssup`, "Sales support") | 1280 | Jobs | ✓ 8 items (S) | ✓ | ✓ | ✓ 7 tabs | ✓ | ✓ MOF summary only | V ✓ after fix (table fit) | fixed |
| Jess | 1280 | Measurements, Photos, Actions | ✓ | ✓ | - | ✓ | ✓ | ✓ Saved to Drive; ✗ no Done on actions | S | [SW3] |
| Jess | 390 | all | - | - | - | - | - | - | - | - |
| Awal (site) | 1280 | Jobs | ✓ 9 items (S) | ✓ | ✓ | ✓ no Daily log tab, as in the demo | ✓ | ✓ Log site visit, Log first visit; app adds "Verify work" | V ✓ | L21 |
| Awal | 1280 | Other tabs | - | - | - | ✓ | - | - | S | - |
| Awal | 390 | Jobs, Site log, Measurements, Photos, Actions, Stock returns | - | - | - | - | - | - | O ✓ no overflow | - |
| Vanessa (bd) | 1280 | Jobs | ✓ (S) | ✓ | ✗ no jobs in app, demo has her team's | ✗ counts on tabs she cannot act on | ✓ | ✓ MOF summary only | V ✗ | [SW4] |
| Marketing | both | - | not reachable (no active marketing person) | | | | | | - | L21 |

## Not compared (so no one assumes it was)
- Marketing role (not reachable). Akmal, Jess, Wai Mun, Vanessa at 390 px. Wai Mun and Awal on tabs other than Actions
  and Jobs at 1280 (structure of the same components the MD view already showed).
- Printed output; nothing here prints. WhatsApp links (integration).
- Log work wizard steps 3 and 4 at 390 as screenshots (overflow only); "Didn't go", away-day save, MC photo upload.

## What was fixed in this task (UI and strings, in 15 files)
- `today/log/wizard.tsx`: scroll effect no longer returns a Promise (the wizard crashed in Chrome 157).
- `today/log/wizard-controls.tsx`, `site-step.tsx`, `activity-step.tsx`, `saved-step.tsx`: demo-style choice buttons, four
  activities across, saved-step buttons.
- `site-work/page.tsx`, `jobs-tab.tsx`, `site-log-tab.tsx`, `shoot-requests-table.tsx`, `mof-finder.tsx`,
  `new-mof-banner.tsx`: heading, stage tiles, wrapped cells, three tiles across, no wrapped MOF number, banner on a phone.
- `lib/i18n/bm.ts`, `lib/i18n/bm-site-work.ts`, `lib/auth/sidebar-items.test.ts`: BM wording from the demo, Tasks and
  Leave in BM.
- `lib/domain/site-log.ts`: owner label "Client / main contractor".
