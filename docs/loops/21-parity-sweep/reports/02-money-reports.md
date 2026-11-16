# 02 Parity: loop 14 money and reports (2026-11-16)

Test copy `gq-crm-dev`, `pnpm dev` in the worktree, demo on port 3112, Chrome profile "Agent".

## How it was run
- Structure diff: the procedure's snippet, run live in both tabs for Vicky. For the other people the app side was read
  from each page's server-rendered HTML (same selectors, no visibility filter); the demo side used the snippet after
  switching "Signed in as".
- 1280: the Chrome window. 390: Chrome will not shrink a window below about 500 px, so each screen was loaded in a
  390 px wide frame (media queries answer to the frame). Every screen a person can open was checked for horizontal
  overflow in that frame, for every person below.
- Side-by-side screenshots were taken for: MOF Register (Vicky, 1280 and 390), Commission (Vicky and Sarah, 1280),
  Performance (Vicky, 1280), Team Reports (Eddie 1280, Vicky 390 both sides), Director Report (Vicky, 1280), site
  report (structure only). Other cells say "-".
- Legend: ✓ matches; ✗ differs (ID in the last column: [M1] etc. are rows in `docs/office-parity/drift-after-sweep.md`,
  "L21" is a line under "Loop 21" in `docs/decisions.md`, "fixed" was fixed in this task); - not compared separately.
- Sidebar: Vicky's list equals the demo's, item for item. The other people's sidebars were not re-diffed here (loop 11
  passed them all).

## Check first (loop 14 list)
- Two-step review: Vanisha submitted the October report (late); Eddie (director) pressed "Mark reviewed" and it read
  "Waiting for the MD's final approval"; Jany (accounts) saw no approve button; Vicky pressed "Give final approval"
  on Vernice's reviewed report and it read "Final approval by Vicky". Works. ✓
- Report print: the sheet fits A4 (10 mm margins, 190 mm): sales report 682 px of 1047, site report 767 px, no content
  wider than the page. Prepared / Reviewed / Acknowledged signatures are on it. ✓ (measured from the print markup in
  a 718 px frame; no print dialog was opened)
- BD retitle: Vanessa's page reads "Marketing director monthly report · Vanessa". ✓
- Marketing Director cannot open Team Reports: confirmed (known debt, not drift). ✓
- Variation order: added VO2 on MOF-2026-009 (finished job, needs delivery/installation). The dialog warns the site
  supervisor marked it 100%, the toast reads "The job is open again for the site team", Awal's Log work page shows the
  "Additional work" alert, and "OK, noted" clears it. ✓
- Bug found and fixed: `/mofs` returned a server error for the Marketing Director (ZodError in the delivery log: a DO
  whose MOF she cannot read came back with no MOF). Fixed in `delivery-log-data.ts` with a test.

## MOF Register (`/mofs`)
| Person | Width | Sidebar | Heading | Tiles | Filters | Tabs | Columns | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ | ✓ fixed (case); subtitle ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | [M1] [M2] [M3] L21 (Targets) |
| Vicky (md) | 390 | - | ✓ | ✗ | - | ✗ | - | - | ✓ no overflow, same shape as 1280 | same |
| Jany (accounts) | 1280 | - | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ same as Vicky | - | [M1] [M2] [M3] |
| Jany (accounts) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Wai Mun (support) | 1280 | - | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ same as Vicky | - | [M1] [M2] [M3] |
| Wai Mun (support) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Vanessa (bd) | 1280 | - | ✓ "My Sales" | - | - | - | - | - | - | was a server error, fixed; not diffed with the demo |
| Vanessa (bd) | 390 | - | - | - | - | - | - | - | no overflow | - |
Not allowed, as in the demo: Eddie, Cavan, Akmal, Sarah.

## MOF detail (`/mofs/[id]`)
| Person | Width | Sections | Variation orders | Additional-work alert | Change history | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|
| Vicky | 1280 | ✓ same as demo sheet | ✓ fields as the demo | ✓ (site side) | ✓ card present, entries not diffed | ✓ | - | L21 (page, not modal) |
| Vicky | 390 | - | - | - | - | - | no overflow | - |
| Jany | 1280 | ✓ | - | - | - | - | - | - |
| Jany | 390 | - | - | - | - | - | no overflow | - |
| Wai Mun | 1280 | ✓ | - | - | - | - | - | - |
| Wai Mun | 390 | - | - | - | - | - | no overflow | - |
| Vanessa | 1280 / 390 | opens; not diffed | - | - | - | - | no overflow | - |

## Commission (`/commission`) and settings (`/commission/settings`)
| Person | Width | Sidebar | Heading | Tiles | Filters | Tabs | Columns | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ | ✓ | ✗ | ✗ | ✓ none | ✗ | ✗ "Pay out" vs "Record claim"; Appeals link and Commission settings link | ✗ | [C1] [C2] [C3] |
| Vicky (md) | 390 | - | ✓ | ✗ | - | - | - | - | ✓ no overflow; table scrolls inside its card | same |
| Jany (accounts) | 1280 | - | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ Pay out, Appeals link, no settings link | - | [C1] [C2] [C3] |
| Jany (accounts) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Eddie (director) | 1280 | - | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ no Pay out | - | [C1] [C2] [C3] |
| Eddie (director) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Vanessa (bd) | 1280 | - | ✗ "Commission" vs "My commission" | ✗ | ✗ | ✓ | ✗ | ✓ | - | [C1] [C4] |
| Vanessa (bd) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Cavan (sales) | 1280 | - | ✓ fixed ("My commission") | ✗ | - | ✓ | - | ✓ none | - | [C1] [C5] |
| Cavan (sales) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Sarah (site, sells) | 1280 | ✓ "My commission" | ✓ fixed | ✗ | - | ✓ | - | ✓ none | ✗ app shows the empty state | [C1] [C5] |
| Sarah (site, sells) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Vicky, settings | 1280 | - | ✓ | - | ✓ rule fields match (app has extra) | - | - | ✓ Save rules | - | L21 |
| Vicky, settings | 390 | - | - | - | - | - | - | - | no overflow | - |
Settings is not available to Jany, Eddie, Vanessa, Cavan, Sarah (redirect to "Not available for your role"), as in the demo.

## Sales Performance (`/performance`)
| Person | Width | Sidebar | Heading | Tiles | Filters | Tabs | Columns | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ | ✓ | ✓ four tiles, same labels | ✗ Year plus a Show button | ✓ | ✗ one merged table, no Collected % | ✓ | ✓ team panel and chart match in shape | [P2] L21 |
| Vicky (md) | 390 | - | ✓ | - | - | - | - | - | no overflow | - |
| Jany, Eddie, Vanessa, Cavan | 1280 / 390 | - | ✗ page redirects to the dashboard | ✗ | - | - | - | - | - | [P1] |
Not opened by Akmal, Sarah, Wai Mun (as in the demo's matrix).

## Reports: Team Reports (`/reports/team`)
| Person | Width | Sidebar | Heading | Tiles | Filters | Tabs | Columns | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ | ✓ fixed (case) | ✓ none | ✗ | ✓ Salespeople / Site supervisors | ✗ no Outstanding | ✓ | - | [R1] |
| Vicky (md) | 390 | - | ✓ | - | - | ✓ | - | - | ✓ both sides, no overflow | [R1] |
| Eddie (director) | 1280 | - | ✓ | ✓ | ✗ | ✓ | ✗ no Outstanding, no visits bar | ✓ | ✓ | [R1] |
| Eddie (director) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Jany (accounts) | 1280 | - | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ no review buttons | - | [R1] |
| Jany (accounts) | 390 | - | - | - | - | - | - | - | no overflow | - |
Review pages: Vicky shows "Give final approval", Eddie "Mark reviewed", Jany only Print.

## Reports: Director Report (`/reports/director`)
| Person | Width | Sidebar | Heading | Tiles | Filters | Tabs | Columns | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ | ✓ fixed (case); subtitle ✗ | ✓ none | ✗ | ✓ | ✗ | ✗ | ✗ Eddie's row missing | [R2] |
| Vicky (md) | 390 | - | ✓ | - | - | - | - | - | no overflow | - |
| Jany (accounts) | 1280 / 390 | - | ✓ | ✓ | ✗ | ✓ | ✗ | - | no overflow | [R2] |
| Vanessa (bd) | 1280 | - | ✓ retitle "Marketing director monthly report" | - | - | - | - | - | - | - |
| Vanessa (bd) | 390 | - | - | - | - | - | - | - | no overflow | - |
| Eddie (director) | 1280 / 390 | - | ✗ empty state | - | - | - | - | - | no overflow | [R2] |

## Reports: my report and Site report (`/reports`)
| Person | Width | Sidebar | Heading | Tiles | Sections | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|
| Vanisha (sales) | 1280 | ✓ "My Report" | ✓ | ✓ | ✓ measures, highlights, plan, support | ✓ Save draft, Submit report, Print report | ✓ | - |
| Vanisha (sales) | 390 | - | - | - | - | - | no overflow | - |
| Cavan (sales) | 1280 / 390 | - | ✓ "Sales monthly report · Cavan" | - | - | - | no overflow | - |
| Akmal (site) | 1280 | ✓ "My Report" | ✓ | ✗ no shooting / handover tiles | ✗ itinerary columns; no schedule-check panel | ✓ | - | [S1] L21 |
| Akmal (site) | 390 | - | - | - | - | - | no overflow | - |
| Sarah (site, sells) | 1280 / 390 | - | ✓ | - | - | - | no overflow | - |
Not opened by Vanessa, Eddie, Jany, Wai Mun (Eddie, Jany and Vicky are sent to Team Reports), as in the demo.

## Not covered
- Commission screenshots for Eddie, Jany, Vanessa, Cavan and the performance, MOF and report screens for people other
  than Vicky were compared by structure only; no per-person screenshot pairs.
- Commission as Cavan and Sarah was seen only as the empty state (the seed has no lines for them) [C5].
- MOF change history contents and the cost-hiding rule were not diffed.
