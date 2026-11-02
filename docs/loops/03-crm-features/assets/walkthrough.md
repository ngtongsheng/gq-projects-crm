# Walk-through per role (2026-11-02)

Run on localhost (`pnpm dev`, test copy with example data) in Claude in Chrome. Seven test sign-ins exist,
`test-<role>@example.invalid` for md, director, bd, sales, accounts, site and support. Tong Sheng hands out the
passwords; they are not kept in the repo.

Method per role: sign in, load every screen in the sidebar, open a detail, make one representative change where the role
may write, check the screens the role must not reach, sign out. Screens were also fetched as that role to catch
server errors and wrong redirects. The 390px check used a 390px-wide frame, because resizing the Chrome window did not
change the page width.

## Results

| Role | Result | Notes |
|---|---|---|
| MD (Farid Azman) | Pass | All 17 sidebar entries load. Approved an overtime claim, saved a MOF edit. Reservations page loads (project to MOF link works). People page shows the "work on the preview link or the live site" message by design. |
| Sales Director (Lim Wei Jian) | Pass | No MOF Register or People entry; both refused. Director Report shows its empty state ("seen by the MD and HR & Accounts"). Approved a customer ownership request. |
| BD Director (Priya Nair) | Pass | Team Reports refused; Director Report is her own monthly report (saved a draft). My Sales shows only her orders. |
| Sales (Daniel Chong) | Pass | Logged an activity on a customer. MOF is read-only with no cost. Commission and Collection show only his orders (view only). Settings, Director Report and People refused. |
| HR & Accounts (Siti Aminah) | Pass, one question | Recorded a payment; commission figures updated. Sees cost. Question: the MOF form is editable for this role (see checklist). |
| Site Supervisor (Raj Kumar) | Pass | Sidebar is Installation Calendar, Site Work, Overtime, My Report, Guide. Everything else refused. Verified an installer claim from Site Work. At 390px: confirmed a booking, logged a site visit, opened the overtime form. |
| Purchasing (Nurul Huda) | Pass | Dashboard, Delivery & Installation, MOF Register, Site Work, Overtime, Stock, Guide. No cost on MOFs. Confirmed a stock hold request. 390px: no sideways overflow on any of its screens. |

## Bugs found and fixed
1. Dashboard and Site Work crashed for MD, Sales Director and Site Supervisor ("Could not load installer claims"). The
   claims query named a column that does not exist. Fixed in `src/app/(app)/site-work/site-work-data.ts`.
2. The monthly report page was wider than a phone screen (figures table pushed the page sideways). Fixed in
   `src/components/app/app-shell.tsx` (the page column may now shrink). All Site Supervisor screens and the Purchasing
   screens are within 390px after the fix.

## Not tried
Adding people (live app only, by design), pay-out submission, paste-from-sheet imports, stock Release / Delivered
(these may open browser confirm boxes), creating projects and bookings as Sales, submitting monthly reports.
Once, a customer page took about a minute to open on the first try and was fast on the second; not reproduced.

## Test people: how and when they go
They stay for Vicky's review. After she signs off this checklist, Tong Sheng removes the seven test sign-ins and the
example data from the test copy. They were never in the live app. Vicky to confirm: remove straight after sign-off?

## Checklist for Vicky
Open the app on your laptop and tick each line. Tell me anything that looks wrong or confusing.

### Rules to confirm (the app uses these now)
- [ ] Commission base rates: 3% when the salesperson found the customer, 1.5% when it was passed down, 1.5% for a
      company account.
- [ ] Profit tiers: below 20% profit means no commission. 20% to 30% pays a lower rate (1.5% on your own customers, 1%
      otherwise). Above 45% adds 1% extra.
- [ ] Late payment cuts, counted from the invoice date: 25% off commission after 90 days, 50% off after 120 days.
- [ ] Two salespeople on one order share it half and half.
- [ ] One person is paid a flat 1% on passed-down sales, and one person gets no commission. Check the right people are
      set (People, then Settings on each person).
- [ ] Commission can be claimed only once 90% of the invoice is paid.
- [ ] An order's invoice amount is the contract sum plus variation orders. Changing it needs a reason.

### Look-through
- [ ] Each person sees only their own menu: MD, Sales Director, BD Director, Sales, HR & Accounts, Site Supervisor,
      Purchasing.
- [ ] Salespeople cannot see what GQ paid for an order (cost); Purchasing cannot either.
- [ ] HR & Accounts can record payments and commission pay-outs. Should they also be able to edit an order (MOF)? Today
      they can; the plan said "view only except payments and commission".
- [ ] Sales Director has no MOF Register and sees the BD Director's report only through the MD. Is that right?
- [ ] Site Supervisor can open Site Work, confirm bookings, log visits, claim overtime and verify an installer claim,
      and everything fits a phone.
- [ ] Customers, projects, orders, stock, collection and commission use words your team knows. Note any that do not.
- [ ] Dates and amounts look right (Malaysia time, RM).
- [ ] The example data is clearly fake and can be wiped before real data goes in.
