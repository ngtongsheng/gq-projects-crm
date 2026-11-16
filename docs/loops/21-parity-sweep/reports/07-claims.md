# 07 Parity: loop 19 Claims (2026-11-16)

Test copy `gq-crm-dev`, `pnpm dev` in the worktree, demo on port 3112 (reset first, then a November claim added for Vanisha
and Awal by script so the manager list had rows), Chrome profile "Agent". Re-seeded at the end.

## How it was run
- Legend: **V** compared visually (screenshots of the demo and the app) and by structure; **S** structure only (text and
  button lists from both sides); **A** app only (screenshot, text or measurement; the demo side was not run for that
  cell); **O** only checked for horizontal overflow (page overflow 0 and nothing outside a table card); **-** not run.
  Checklist letters: Side = sidebar (Claims item label only; the whole sidebar belongs to the shell tasks), Head =
  heading and subtitle, Tiles (none on these screens), Ctl = filters and controls, Tabs, Cols = table columns, Btn =
  buttons per role. ✓ matches, ✗ differs. `[CL1]`.. are rows in `docs/office-parity/drift-after-sweep.md`; "L21" is a line
  under "Loop 21, Claims" in `docs/decisions.md`; "fixed" was fixed in this task.
- 1280: the Chrome window (1280 x 657). 390: every 390 cell was loaded in a 390 px frame (iframe, so media queries answer
  to the frame), app and demo both; page overflow was 0 on every app cell and every demo cell run.
- People (roles that see Claims, from `ROLE_PAGES`): md = Vicky, accounts = Jany, director = Eddie, bd = Vanessa, sales =
  Cavan (Vernice and Vanisha for commission and flow), site = Awal, site who sells = Sarah. Designer, support, ssup and
  marketing do not see Claims (Jess's `/claims` goes to "Not available").
- Visual (V) cells: Vicky All claims 1280 and 390, Vicky Settings 1280, Vicky review page 1280 (against the demo's sheet),
  Cavan My claims 1280, Eddie My claims 1280, Awal My claims 1280, Vanessa My claims 390. Structure only (S): Vicky All
  claims with data, Cavan/Vanessa/Awal/Eddie claimant text. Every other cell is A or O as the tables say. Not run: BM and
  Chinese labels (no way to switch the language of a test person; wording still unreviewed by Vicky), the late-collection
  Appeal dialog and Decide (the example data has no late-cut line and no appeal), the claimant caps read with no service
  key (the key is present on this machine).
- The demo's claim data differs from the seed (amounts, names, dates): never drift.

## Check first (drift doc list and loop 19 log todo)
- **Embedded `profiles(...)` selects (`all-claims-data`, `claim-review-data`): server error for HR & Accounts.** Jany
  reads only her own profile, so the embed came back null for everyone else and the list threw "expected object,
  received null" (the review page and the "no flags" job-role lookup had the same cause, and the "Not submitted yet" line
  listed only her). Fixed with `claim_people()` (new migration, no data loss) and `claim-people-data.ts`; the printed
  form's checker name now uses `team_directory()`. L21. Test: `supabase/tests/claim-people.test.ts`.
- **Review page `/claims/[id]` crashed for every role** ("Attempted to call reviewKey() from the server"): a client
  module's helper was called in a server page. `reviewKey` moved to `src/lib/domain/claim-review.ts`. Fixed, L21.
- **Settings save refused for the MD and HR & Accounts** ("Only the MD or HR & Accounts can change..."): an upsert on
  `app_settings` also writes the key column, which was not granted for update. Same failure on Commission settings (MD
  tried); stock settings and site reminders use the same upsert. Fixed with `grant update (key)` (migration
  `20261120110000_app_settings_upsert.sql`, no data loss); saved again as Vicky (claims, commission) and as Jany
  (claims) after the fix. L21. Test: `supabase/tests/app-settings-upsert.test.ts`. This is the pg-safeupdate class of
  bug: green in PGlite plain SQL, red through PostgREST. Stock settings and site reminders were not re-run in the browser.
- `key:mof_id` / `key:id` aliases in `claim-review-actions`: exercised by adjusting a petrol amount (Jany, "Saved." and
  "Adjusted from RM 620.00" shown) and by Approve (Jany, Vicky). OK.
- md and accounts read others' activities and site logs ("nothing logged that day" flag): both saw the same count
  (8 to check on Vanisha's October claim). OK.
- Checker expense update vs guard triggers: Jany lowered a petrol line 620 to 520 with a reason and a remark and ticked
  "original receipts received": saved, total went to RM 1,883.00 with the original-vs-final banner. OK.
- `checker:profiles!changed_by` embed on the print page: replaced (see the first item). Print sheet height (the sheet
  is hidden on screen, measured at the 718 px printable width with its print classes): Vernice 659, Vanisha 654, Awal 738
  px of 1,047 available: fits one A4 (A).
- Accounts and the Sales Director decide OT: Jany approved one as OT claim and one as replacement leave; Eddie rejected
  one. All three saved (no `UPDATE` without WHERE: every `.update()` and `.delete()` under `claims/` and `overtime/`
  carries a filter, checked by reading each).
- Flow end to end: submit gate (Cavan: "Please submit your Oct 2026 monthly report first." with the gate on; Vanisha
  submitted before the first fix), check (Jany "Pass to the MD"), approve (Jany; Vicky on a flagged claim with a remark),
  pay (Jany "Mark paid" after the MD gave Awal's October report final approval; before that "Hold payment until this
  person's Oct 2026 monthly report is approved by the MD" showed), return (Jany, with a reason). Add and delete an expense,
  a receipt upload (a small PNG, R1 shown), tick and untick a commission line (Vernice, MOF-2026-009): all OK.
- Director sees "Overtime to decide" (Eddie), with pending entries first. OK.

## Claims, claimant view (`/claims` for sales, bd, director, site)
| Person | Width | Side | Head | Ctl | Tabs | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|
| Cavan (sales) | 1280 | ✓ "My claims" | ✗ shorter subtitle, role names | ✗ no visit-count note | ✗ month tabs, demo has none | ✓ | ✗ "Add expense" vs "+ Add"; "Submit ... claim" without "to Jany"; extra "Add overtime" (fixed) | V ✗ banner colour, report-due line | fixed, L21, [CL1] |
| Cavan | 390 | ✓ | ✓ | - | ✓ | ✓ | ✓ | O ✓ (overflow 0) | - |
| Vanessa (bd) | 1280 | ✓ | ✗ as Cavan | ✗ | ✗ | ✓ | ✗ as Cavan | S | L21, [CL1] |
| Vanessa | 390 | ✓ | ✗ as Cavan | ✗ | ✗ | ✓ | ✗ | V ✗ demo has the header stacked [SW5], longer subtitle, green banner | L21, [CL1] |
| Eddie (director) | 1280 | ✓ "Claims" | ✗ heading was "Claims", demo "My claims" (fixed) | ✗ | ✓ | ✓ | ✗ as Cavan; section 1 numbered, demo unnumbered (fixed) | V ✗ as Cavan | fixed, L21, [CL1] |
| Eddie | 390 | ✓ | ✓ | - | ✓ | ✓ | ✓ | O ✓ | - |
| Awal (site) | 1280 | ✓ "My claims" | ✗ as Cavan | ✗ | ✗ month tabs | ✓ OT table columns match | ✗ as Cavan | V ✓ sections "Travelling expense", "2 · Overtime / replacement leave" match; ✗ banner | L21, [CL1] |
| Awal | 390 | ✓ | ✓ | - | ✓ | ✓ | ✓ | O ✓ | - |
| Sarah (site, sells) | 1280 | ✓ | ✓ | - | ✓ | ✓ | ✓ commission, expense, OT sections as the demo's rule | A | - |
| Sarah | 390 | ✓ | ✓ | - | ✓ | ✓ | ✓ | O ✓ | - |
| Vernice (sales, has OT entry) | 1280 | ✓ | ✓ | - | ✓ | ✓ commission table | ✓ | A | - |

Fixed in the app: the Overtime section showed for every claimant (demo: site supervisors, or anyone who has an entry);
the Sales Director's page was headed "Claims" (demo "My claims"); the Travelling section was numbered "1" for people
with no commission (demo numbers it only with commission, and counts Overtime as 2 or 3).

## All claims, Review, Settings, Appeals, Overtime to decide (managers: md, accounts)
| Screen | Person | Width | Side | Head | Ctl | Tabs | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| All claims | Vicky (md) | 1280 | ✓ | ✗ subtitle | ✗ month tabs not a select | ✗ extra "Appeals" | ✓ Name, Commission, Travel expense, Submitted, Status | ✓ Open | V ✗ flow banner blue (demo green), "RM 0.00" where demo has "—" (fixed), date with year, "1 to check" without warning icon, extra "Overtime to decide" panel | fixed, L21 |
| All claims | Vicky | 390 | ✓ | ✓ | ✗ | ✗ | ✗ app hides Commission and Submitted, demo keeps Commission and scrolls | ✓ | V ✗ | L21 |
| All claims | Jany (accounts) | 1280 | ✓ | ✗ as Vicky | ✗ | ✗ | ✓ | ✓ | A (app only; same page as Vicky) | L21 |
| All claims | Jany | 390 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | O ✓ | L21 |
| Review `/claims/[id]` | Vicky | 1280 | ✓ | ✗ full page, demo is a modal sheet | ✓ amount boxes on adjustable lines | - | ✓ Date, Type, Where / what, Amount, Receipt no. | ✓ Return, Save changes, Pass to the MD / Approve; ✗ no inline OT buttons when none pending | V ✗ sheet vs page | L21 |
| Review | Vicky | 390 | ✓ | ✓ | ✓ | - | ✓ scrolls inside its card | ✓ | O ✓ | - |
| Review | Jany | 1280 | ✓ | ✓ | ✓ | - | ✓ | ✓ Return, Save changes, Pass to the MD, Approve; Mark paid on an approved claim | A | - |
| Review | Jany | 390 | ✓ | ✓ | ✓ | - | ✓ | ✓ | O ✓ | - |
| Settings | Vicky | 1280 | ✓ | ✗ no card title | ✗ late-collection cuts live on Commission settings (md) | ✓ | - | ✓ Save | V ✗ | L21 |
| Settings | Vicky, Jany | 390 | ✓ | ✓ | ✗ as above | ✓ | - | ✓ | O ✓ | L21 |
| Settings | Jany | 1280 | ✓ | ✗ | ✗ | ✓ | - | ✓ | A | L21 |
| Appeals | Vicky | 1280 | ✓ | ✗ not in the demo's segment bar | - | ✗ extra | - | - | A (empty state) | L21 |
| Appeals | Vicky, Jany | 390 | ✓ | ✓ | - | ✓ | - | - | O ✓ | - |
| Overtime to decide | Vicky, Jany | 1280 | ✓ | ✗ not in the demo's Claims (decided from the review sheet and the Dashboard) | - | - | - | ✓ OT claim, Replacement leave, Reject | A | L21 |
| Overtime to decide | Jany | 390 | ✓ | ✓ | - | - | - | ✓ | O ✓ | - |
| Overtime to decide | Eddie | 1280 | ✓ | ✓ | - | - | - | ✓ | A | - |
| `/overtime` deep link | Awal | 1280 | ✓ | ✓ | - | - | - | ✓ Add overtime (dialog fits the window) | A | - |
| `/overtime` | Awal | 390 | ✓ | ✓ | - | - | - | ✓ | O ✓ | - |
| Claim print | Vicky (3 claims) | print | - | - | - | - | - | - | A: 659, 654, 738 of 1,047 px, one A4 | - |

## Test copy changes made by the check (restored by re-seeding at the end)
New migrations `20261120100000_claim_people.sql` and `20261120110000_app_settings_upsert.sql` applied to the test copy
(they stay). Claims for Vanisha and Cavan (draft), expense and receipt rows, a commission tick, OT decisions, claim steps
(Awal approved and paid, Vanisha returned), settings saves, Awal's October site report given final approval: all rows
removed by `pnpm seed:example`.
