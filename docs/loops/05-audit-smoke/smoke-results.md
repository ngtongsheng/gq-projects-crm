# Smoke test results

## Sales side (task 10)
Run 2026-11-03 on localhost against the test copy (`pnpm dev`), Claude in Chrome, one sign-in per role. All roles'
sidebars and every route were also fetched as that role (200, right redirects, no error page) and the console was checked
for errors on the Sales dashboard only (none). Test data left behind on the test copy: a smoke activity, MOF-2026-0169999 supplier PO,
company "Smoke Paste Co" and its person, MOF-2699-001, a RM 60,000 payment on MOF-2026-016 and the payout against it,
a rejected and an approved ownership request, one project moved to Sample / Mock-up.

| Module | Roles tried | Result | Findings |
|---|---|---|---|
| Dashboard per role | Sales, BD, MD, Sales Director, HR & Accounts, Purchasing | Pass after fixes. Tiles, attention list and projects to chase load for every role; Sales and BD lacked Today and Visit these soon, the team dashboard lacked Today's itinerary (fixed). Sales Director's team table omits the BD Director by decision (loop 03 #28) | 53 |
| Sales Calendar | Sales | Pass. Month and week, add dialog, planned activity refuses Complete before its time. Click opens the customer page, no monthly list | 57 |
| Customers, companies, contacts | Sales, MD, Sales Director | Pass after fixes. Search, add, duplicate mobile warning, edit gating, CSV, paste import of companies and customers (preview, refusal reasons, save). A refused add used to wipe the form (fixed). No Companies view or status filters | 48, 50, 54 |
| Ownership requests | Sales, MD, Sales Director | Pass. Request needs a reason, shows Requested, MD reject and Sales Director approve change the owner and the history | none |
| Activities | Sales | Pass. Log from calendar and customer page, Complete / Cancel / Edit on the customer page | 57 |
| Projects (pipeline) | Sales, MD, Sales Director | Pass. Board and list, stage change on own projects only, overdue badge, add from the customer page. Sales can read everyone's projects (prototype shows own only) | 55 |
| MOF Register and My Sales | Sales, MD, HR & Accounts, Purchasing | Pass. Own-only list for Sales with no cost, stage select, read-only form for Sales, over-total and reason fields, paste import (preview, save), CSV. Prototype tiles, month filter and extra tabs missing | 56 |
| Supplier POs | Purchasing | Pass. Add PO (running no. appended to the MOF no., ETA = PO date + lead time), edit listed | none |
| Collection | Sales, MD, Sales Director, HR & Accounts | Pass after fixes. Own-only for Sales, payment dialog, remove payment. Over-payment was accepted (fixed); salesperson and last payment added | 49, 52, 58 |
| Commission | Sales, MD, Sales Director, HR & Accounts | Pass. Sales sees own rows and the explanation, view only; MD and HR & Accounts pay out; payout above payable is refused; figures match a hand check (RM 96,000 x 1.5% x 92.5% = RM 1,332.00). Seeded payouts exceed earned on three MOFs (seed data, not the app) | 48 |
| Team / My Report | Sales, MD | Pass after fix. Draft and submit rules (3 highlights), manager review view of a reviewed report. A refused submit wiped the typed text (fixed) | 48 |
| Director Report | BD, MD, HR & Accounts, Sales Director | Pass. BD fills and submits its own, MD and HR & Accounts see the list, Sales Director sees the by-decision empty state | none |
| CSV export | Sales, MD | Pass. Customers, MOFs, stock and leftover download for allowed roles (cost column absent); Sales Director refused on MOFs | none |
| Paste import (customers, MOFs, stock, leftover) | MD (customers, companies, MOFs), Purchasing (stock) | Pass after fix. Previews, errors and saves work; the Status column was off screen (fixed). Leftover paste uses the same dialog and was not run separately | 50 |
| In-app guide | All seven roles' route fetch, Sales read | Pass after fix. Customers entry said Sales only sees their own customers (fixed) | 51 |

Not tried: browser confirm boxes (none met on these screens), 390px (task 11), Sign-in / set-password failure screens
(admin-only link flow), commission settings save (read only), leftover paste save, MOF paste update of an existing MOF.

## Operations side (task 11)
Run 2026-11-03 on localhost against the test copy (`pnpm dev`), Claude in Chrome, one sign-in per role (HR & Accounts,
Site Supervisor, Sales, Purchasing, MD). Console checked for errors on the Installation, Site Work and Stock screens
(none). The Site Supervisor screens were also checked at 390px in a 390px-wide frame, because `resize_window` does not
change the page width: no sideways overflow on Installation Calendar (month and week), Site Work and a job, Overtime, My
Report, Guide, and the Log a visit, Record leftover, Add follow-up, Add overtime (long site name) and Book a site
supervisor dialogs. Test data left on the test copy: installer claim CLM-SMOKE (RM 10,000, not verified) on
MOF-2026-014 and CLM-001 there now verified and paid RM 13,300; a site visit, a follow-up and a leftover ("Smoke offcut
tile", 3 box) on Sutera; a replacement-leave overtime claim (3 hrs, approved); a declined supervisor booking on 10 Nov;
a Delivery job on MOF-2026-016 on 17 Nov with DO MOF-2026-0165563 (Done, signed, not final); a released 5 box hold on
HCM-TILE-SLATE; a returned-to-supplier leftover with credit note CN-SMOKE-1 (RM 600).

| Module | Roles tried | Result | Findings |
|---|---|---|---|
| Installer POs and claims | HR & Accounts, Site Supervisor, Purchasing | Pass after fix. Add claim past the PO amount is refused with the figures and keeps the typed values; valid claim added; Payable now matches a hand check (RM 24,000 claimed - 1,200 deducted - 1,200 retention - 13,300 paid = RM 8,300); Site Supervisor verifies from Site Work; Accounts pays only the verified claim, payment above the claim refused, suggested amount = claim less retention. Purchasing adds and edits POs and claims but cannot verify or pay. Table lost its last two columns off screen (fixed) | 63 |
| Delivery & Installation jobs and DOs | Purchasing, HR & Accounts, Sales, MD | Pass after fixes. Schedule job from a day or the header; delivery gate warns (non-blocking, as in the prototype) when payment or DO pre-approval is not ticked; DO no. = MOF no. + 4 digits, anything else refused with values kept; transporter, items, signed flag; status select; MOF shows "Partially delivered (1 DO)". HR & Accounts and Sales see no Schedule job button. Dialog clipped its fields when a MOF with a long name was picked, dates were cut, DO prefix wrapped (fixed) | 60, 61, 63 |
| Installation Calendar | HR & Accounts, Site Supervisor, Sales, Purchasing, MD | Pass after fix. Month grid and week list; Site Supervisor sees only their own jobs and bookings; read-only for HR & Accounts; phone list at 390px. Prototype's Coming up table, unsigned-DO list and supervisors-only view not built | 65 |
| Site supervisor booking | Sales, Site Supervisor, MD | Pass. Sales books (blank site refused with values kept), request shows on the calendar, Site Supervisor sees the waiting banner, confirms one and declines another with a reason (shown faded with the reason); MD can also book. Availability hint, cancelling and others deciding are by decision (loop 03 #19) | 65 |
| Site Work (stage, site log, follow-ups) | Site Supervisor, Sales, MD | Pass. Stage list and percentages match the prototype (10, 25, 45, 60, 80, 100) and each change shows a toast; a visit with an invalid Drive link is refused; follow-up closing follows the owner mapping (Site Supervisor closes Client items only, Sales only their own, MD any), disabled otherwise; installer claim verify. Cross-job views of the prototype missing | 66 |
| Overtime claims and approval | Site Supervisor, MD | Pass. 22:00 to 01:10 counts as 3 hrs (past midnight, nearest half hour); long site name fits at 390px; MD approves as OT claim or replacement leave and the totals move (4 + 3 hrs leave); Site Supervisor sees only their own | none |
| Leftover / stock returns | Site Supervisor, Purchasing | Pass. Site records leftover from the job page (0 quantity refused); Purchasing updates status, condition and credit note (negative amount refused, number and amount show on the line). The prototype's "Use for project" step and sold quantities are not built | 66 |
| Stock items and reservations | Sales, Purchasing | Pass after fixes. Sales request a hold (over-available refused with "Only 20.00 left", message and values kept; available shows in the dialog); Purchasing confirms (hold until = date + 14), extends (+14 days), releases; Held and Available stay consistent (GARNET 200 held = 120 + 80 asked); duplicate SKU refused ignoring case; no browser confirm boxes. Action buttons were off screen (fixed). On-hand can be set below held (debt) | 62, 64 |
| Site Supervisor at 390px | Site Supervisor, Sales (booking) | Pass. See the frame check above | 60 |

Not tried: Director and BD roles on these screens (same permissions as MD for scheduling and booking; not signed in),
installer PO create and edit saves (dialog opened only), editing a job's date range past a postponed job, Delivered on
a hold (button present, same action path as Release), paste import of stock and leftover saves, the Purchasing role at 390px.
Database-level refusals from the 20261104* migrations (not applied to the test copy).
