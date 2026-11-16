# 03 Parity: loop 16 People, HR, Tools (2026-11-16)

Test copy `gq-crm-dev`, `pnpm dev` in the worktree, demo on port 3112, Chrome profile "Agent".

## How it was run
- Legend: **V** compared visually (side-by-side screenshots) and by structure; **S** structure only (snippet or
  server-rendered page read through the same selectors, no screenshot); **O** only checked for horizontal overflow in a
  390 px frame; **-** not run. ✓ matches; ✗ differs (ID: `[PE1]` etc. are rows in
  `docs/office-parity/drift-after-sweep.md`, "L21" is a line under "Loop 21" in `docs/decisions.md`, "fixed" was fixed in
  this task).
- 1280: the Chrome window (1280 x 657 viewport, so screenshots show the top of the page and one scroll position).
- 390: Chrome will not shrink the window below about 500 px, so each screen was loaded in a 390 px frame (media queries
  answer to the frame) and both sides were screenshotted that way.
- Other personas were read by signing in through the dev role panel and fetching the page HTML; the demo side by
  switching "Signed in as". Sidebars were diffed item for item for every persona on Tools.
- Test copy was changed (Cavan's 2027 target, Vernice marked as left and handed over to Cavan) and put back with a
  re-seed at the end.

## Check first
- **Yearly targets rollover and write** (migration `20261116120000`): as Vicky, Cavan's settings, "Targets for 2027" held
  RM 1,650,000 / 50 visits already (carried from 2026 by the lazy refresh). Set RM 1,800,000 and 12 visits, saved
  ("Settings saved"), reloaded the page, reopened: 1800000 and 12 stayed. ✓
- **Resignation handover** (migration `20261116130000`): marked Vernice as left on 16 Nov 2026 and handed work to Cavan,
  saved. Cavan's handover list then showed 3 projects and 6 customers "From Vernice · 16 Nov 2026" next to the rows
  handed over earlier from Lisa. The people table showed "Salesperson · Left". No server error in the `pnpm dev`
  output. ✓
- **HR unreachable for every other role**: Eddie, Vanessa, Cavan, Awal, Sarah, Jess, Wai Mun, Affifa all land on "Not
  available for your role" at `/hr` and have no HR in the sidebar (same as the demo, which hides HR for them). View as
  Eddie from Vicky: `/hr` still "Not available". View as Jany: HR opens, as it should (she is HR & Accounts). ✓
- **People is admin only**: Vanessa's `/people` redirects to her dashboard; no one but Vicky has People in the sidebar,
  as in the demo. ✓
- **Form prints fit one A4**: measured the sheet at the print width (190 mm = 718 px, no padding) against the 277 mm
  (1047 px) of usable page height. Before: Measurement 873 / 898 px, Handover 722 / 768 px (blank / filled) fit;
  Work commencement 1090 / 1113 px did not (a second page). Fixed by the demo's tight variant; now 977 / 999 px. Nothing
  wider than the page. No print dialog was opened. ✓ (fixed)
- A server error scan of the `pnpm dev` output over all the pages above: none.

## People (`/people`)
Only Vicky (admin) can open it. Demo: "Signed in as" Vicky.
| Person | Width | Sidebar | Heading | Tiles | Filters | Tabs | Columns | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ (V) | ✓; subtitle ✗ | none both | ✗ (demo has reminder inputs) | none both | ✗ | ✗ | V ✗ (Sales teams panel matches in shape; table differs) | [PE1] [PE2] [PE3] [PE4] L21 |
| Vicky (md) | 390 | - | ✓ | - | - | - | - | - | V ✓ no overflow, same stacking; demo header stacks the person select under the logo | same |
| Settings dialog (Cavan) | 1280 | fields: title, job role, reports to, commission, targets (year, sales, visits), WhatsApp, language, joined, left, reason, handover | - | - | - | - | - | - | S ✗ (demo sheet has no commission or language; app has no new-customers target) | [PE2] |
| Other personas | both | not reachable in app or demo | | | | | | | S ✓ | - |

## HR (`/hr`), md and accounts
| Person | Width | Tab | Sidebar | Heading | Tabs | Tables / sections | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|
| Vicky | 1280 | Policies & schemes | ✓ | ✓ (names to roles) | ✓ | ✓ policies, scheme sections 1-4 text equal | ✗ "Attach file" (demo) | V ✗ (framed list, wording) | L21 |
| Vicky | 1280 | Staff packages | ✓ | ✓ | ✓ | ✓ standard packages, outstation rules, staff table columns equal | ✓ | V ✗ (headed sections, not one card; money in full) | L21 |
| Vicky | 1280 | Sales grades & bonus | ✓ | ✓ | ✓ | ✗ opens with the editable J1-M2 table; Notes column missing | ✓ | S | L21 [H1] |
| Vicky | 390 | Policies | - | ✓ | tabs wrap in both | ✓ | - | V ✓ (fixed: page was 461 px wide, now 390) | fixed |
| Vicky | 390 | Staff packages | - | - | - | - | - | O ✓ | - |
| Vicky | 390 | Sales grades & bonus | - | ✓ | tabs wrap in both | ✗ order as at 1280 | - | V ✓ no overflow | L21 [H1] |
| Jany (accounts) | 1280 | all three | ✓ (HR in sidebar) | ✓ | ✓ same three | policies page: same buttons as Vicky | ✓ | S | - |
| Jany (accounts) | 390 | - | - | - | - | - | - | - | - |
| Eddie, Vanessa, Cavan, Awal, Sarah, Jess, Wai Mun, Affifa | both | HR hidden and `/hr` refused, as in the demo | ✓ | | | | | S (1280) | - |

## Tools & Forms (`/tools`), all roles
Content is the same for every role (only the Drive-link controls differ), so structure was read for every persona and
screenshots were compared for Eddie (1280) and Vicky (390).
| Person | Width | Sidebar | Heading and subtitle | Tabs | Calculators | Forms | Buttons | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ | ✓ | ✓ | S ✓ | S ✓ "Add a form (Google Drive link)" present as in the demo | ✓ | - | - |
| Vicky (md) | 390 | - | ✓ | ✓ | - | V ✓ rows stack; no overflow | ✓ | V ✓ | - |
| Eddie (director) | 1280 | ✗ no "Sales Performance" | ✓ | ✓ | V ✓ Korean 8 m x 2.8 m: 2 rolls, 32.86 m², same lines; vinyl 4800 x 2550: 7.95 / 9.80 lm, same figures; ✗ compact segmented controls | V ✓ (fixed: Work commencement row wrapped) | ✓ | V ✓ | [P1] L21 |
| Eddie | 390 | - | - | - | - | - | - | O ✓ | - |
| Vanessa (bd) | 1280 | ✗ no "Sales Performance" | ✓ | ✓ | S ✓ | S ✓ | ✓ | - | [P1] |
| Cavan (sales) | 1280 | ✗ no "Sales Performance" | ✓ | ✓ | S ✓ | S ✓ | ✓ | - | [P1] |
| Jany (accounts) | 1280 | ✗ no "Sales Performance" | ✓ | ✓ | S ✓ | S ✓; Add a form not shown (admin only) | ✓ | - | [P1] L21 |
| Awal (site) | 1280 | ✓ | ✓ | ✓ | S ✓ | S ✓ | ✓ | - | - |
| Sarah (site who sells) | 1280 | ✓ | ✓ | ✓ | S ✓ | S ✓ | ✓ | - | - |
| Jess (sales support) | 1280 | ✓ | ✓ | ✓ | S ✓ | S ✓ | ✓ | - | - |
| Wai Mun (purchasing) | 1280 | ✓ | ✓ | ✓ | S ✓ | S ✓ | ✓ | - | - |
| Affifa (designer) | 1280 | ✓ | ✓ | ✓ | S ✓ | S ✓ | ✓ | - | - |
| Other personas | 390 | - | - | - | - | - | - | - | page has no role-specific layout; Vicky's 390 check stands for them |
Not compared: the wallpaper and vinyl calculators at 390 as screenshots (overflow check only, no overflow);
the A4 forms against the demo's printed output side by side (only their height and width were measured);
Forms from an awarded MOF were filled from the first MOF in the picker only.

## What was fixed in this task (4 UI fixes, 4 files)
- `tools/print-form-row.tsx`: the form's title block takes the line and the MOF picker and Print stay beside it.
- `tools/forms/commencement-form.tsx`: tight variant, so the form fits one A4 (977 / 999 px against 1047).
- `hr/policy-row.tsx`: icon, title, badge and buttons stay on one row.
- `hr/scheme-summary.tsx`: the long "not checked by GQP Office yet" status wraps; the HR Policies page no longer
  scrolls sideways at 390 px.
- Tried and reverted: adding "Sales target" and "Visits / month" columns to the People table; they pushed the Settings
  button off the 1280 px card. Logged as [PE1].
