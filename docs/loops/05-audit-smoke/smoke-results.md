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
