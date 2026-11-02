# Prototype spec (digest of docs/mockup/gq-crm-mockup.html, 2026-11-02)
Read by a helper; customers, companies and calendar screens were skimmed only. Verify in the prototype before building.

## Nav per job role (prototype `tabsDef`, `role()`)
Dashboard; Sales Calendar; Installation; Customers; Projects (pipeline); MOF Register ("My Sales" for non-managers);
Site Work; Stock; Collection; Commission; Team Reports ("My Report" for sales/site); Director Report (md, director, bd, accounts).
Site role: Site Work, Installation Calendar, My Report. Support role: Dashboard, MOF Register, Delivery & Installation, Site Work, Stock.

## Job roles
md (MD), director (Sales Director), bd (BD Director), sales, accounts (HR & Accounts), site (Site Supervisor), support (purchasing).
isMgr = md/director/accounts; accounts read-only except payment + commission entry (md, accounts);
canReg (MOF register edit) = md/support/accounts; canSite = md/director/site; canStock = md/director/support or a person
with the "arranges stock" setting. Per-person exceptions: excluded from commission; flat 1% on pass-down sales.

## Customers / companies
Contact: company, contact name, mobile (decides ownership, unique), title, company type, rating 1-5 (No related ... VIP),
account type (Own 3% / Pass-down 1.5% / Company account 1.5%), owners, passed-by. Health from last completed activity:
>60 days "Quiet", >90 days "No activity". Ownership request: sales requests a customer; director/MD approve (change owner) or reject.
## Activities
Type: Visit, Site visit, Walk-in, Call, Online meeting. Purpose, outcome, date/time, status planned/Completed/Cancelled.
## Projects (pipeline)
Stages: Lead/Enquiry, Quotation Sent, Sample/Mock-up, Follow-up, Negotiation (open); Awarded, Lost, On Hold.
Fields: customer, lead source, name, qty (sq), value, PIC + support, passed-by, next action + date, commission type, notes.
"Overdue" past next date; "stale" 14 days without update. Est. commission = value x rate.
## MOF register
MOF no., LOA/PO date, salesperson + optional second, linked project, company/project, LOA no., quote no., site address
and contact, office PIC, customer/accounts contact, scope (S&L/Supply/Labour), installer, product lines (product, stock
type, supplier, qty, unit, m2), contract sum, VO, retention %, invoice no./date, cost (managers only), commission type,
delivery date. Stages: Pending order, Ordered, In production, Shipping, Arrived warehouse, Pending delivery,
Delivered-installing, Completed-payment pending, Closed; plus On hold, Cancelled. Four pre-proceed checks (payment checked
before delivery; approvals in writing; artwork signed off; every DO pre-approved). Changing the order total needs a reason.
Total = contract sum + VO. sqft to m2 = / 10.764.
## Supplier POs
Required when a line is indent or custom-made, or MOF total area >= 1,000 m2. PO no. = MOF no. + 4-digit Zoho running no.
Status: Pending order, Ordered, In production, Shipping, At KL supplier warehouse, At Best Link warehouse, Delivered, Cancelled.
ETA = PO date + lead time days.
## Installer POs and claims
Installer PO: no., date, amount, scope, retention %. Claims: Progress / Final / Deduction-back-charge; verified by site
supervisor; paid date. Due = claimed - deductions - retention% x claimed - paid.
## Delivery & installation
Job type Installation / Delivery / Site measurement; status Scheduled / In progress / Done / Postponed. DO no. = MOF no. +
running no.; DO signed-and-returned flag; transporter (Best Link, Lalamove, ...). MOF delivery status derived: Not delivered,
Delivery scheduled, Partially delivered, Fully delivered.
## Site supervisor booking
Sales books a supervisor for measurement, inspection, handover, shooting, meet client, others; supervisor confirms or declines.
## Site work
Site stages with %: Start 10, On-going 25, Shipment 45, Delivered 60, Installation in progress 80, Completed 100.
Site log per visit: activity (Measurement, Inspection, Installation, Handover, Shooting, Touch Up, Delivery, Others);
follow-up actions (owner: Salesperson, Purchasing, Installation team, Site supervisor, Accounts, Client; done flag);
measurement received flag; shooting Drive link; handover signed flag.
## Overtime
Date, from/to time (may cross midnight, hours rounded to 0.5), project, reason, claim as OT claim or Replacement leave;
approved/rejected by MD or director.
## Leftover / stock returns
Condition Good / Cut-offcut / Damaged; destination supplier (credit note) or GQ keeps; status Pending pickup, Returned to
supplier, At Best Link for resale, Left with client, Disposed; credit note no. + amount.
## Stock + reservations
Stock item: SKU, supplier, collection, qty, unit. Available = qty - sold. Reservation: item, qty, project, reserved-by;
Requested, Reserved, PO issued (live), Delivered, Released, Cancelled. Default hold 14 days, warning 3 days before expiry
(settings). Person with "arranges stock" confirms.
## Collection
Per awarded MOF: invoice amount, payments (amount, date, note), received, outstanding. Status: Fully paid / 90%+ (commission
open) / x% paid.
## Commission
Base rate by account type; margin = (invoice - cost) / invoice with tiers (below 20% none, 20-30% low, >45% +1% bonus;
configurable); earned = invoice x rate x % paid - late cut (25% after 90 days, 50% after 120 days since invoice date);
claimable only at >= 90% paid; split 1/2 between two salespeople; flat 1% pass-down person; excluded person gets none.
Claims recorded per person with amount and paid-out date.
## Reports
Monthly report Draft, Submitted, Reviewed; due first Monday of next month at a set time (default 09:00); late flagged.
Sales: visits vs target, new customers, quotations, awarded value, highlights. BD adds pass-down sales. Director report
reviewed by MD. Site supervisor: site visits, shootings, handovers signed (default targets 5/5), OT hours.
Targets: monthly = yearly / 12; pace = workdays elapsed / workdays in month; achieved % colours at 90% / 70%.
## I/O
Paste-from-sheet (tab-separated) for MOFs, companies, stock, leftover. CSV export and copy list. Supplier emails are mailto links.
