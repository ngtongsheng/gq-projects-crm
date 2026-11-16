# Drift left after the loop 21 parity sweep (for loop 22 planning)

Found by running `parity.md` in Chrome against the test copy. Size: S under a day, M a few files with queries, L
migration, new rule or a business answer. IDs are used by the per-task reports in `docs/loops/21-parity-sweep/reports/`.

| Screen | Role | Width | Differs | Size S/M/L | Why not fixed |
|---|---|---|---|---|---|
| MOF Register | md, accounts, support | both | [M1] Demo has five views as tabs (MOFs, Full register, PO tracking, Delivery log, Installer claims); the app is one page (register, then delivery log) plus a separate Summary page | L | Restructures the screen and three data loads, more than 3 files |
| MOF Register | md, accounts, support | both | [M2] Tiles (New MOFs this month, Year-to-date sales, Balance not yet received, Average margin) and the "Sales by salesperson" panel are missing; filters are Stage and Person, not Sales month and Project stage | M | New queries and components, more than 3 files |
| MOF Register | md, accounts, support | both | [M3] No cross-MOF PO tracking or Installer claims list; both live inside each MOF | M | New lists with their own filters |
| Commission | md, accounts, director, bd | both | [C1] The four tiles (Ready to claim now, Waiting for payment, Already claimed, Cut for late collection) and the subtitle about the 90% rule are missing | M | New totals over commission lines, more than 3 files |
| Commission | md, accounts, director | both | [C2] The "By person" summary table (tap a name to filter) is missing; the app groups lines under a name line and has a Person filter | M | New component and totals |
| Commission | md, accounts, director, bd | both | [C3] "Awarded projects" columns differ: demo shows Commission to, Invoice, Margin, Payment received bar, Commission, Claimed, Ready to claim, Balance, Status and a rates footnote; app shows Rate, Earned, Paid out, Remaining, Status | M | Needs the invoice and margin per line in the data load |
| Commission | bd | both | [C4] The Marketing Director sees the team's lines with a Details link; the demo shows only their own lines under "My commission" | S | Needs Vicky's answer on who sees whose commission |
| Commission | sales, site who sells | both | [C5] Not compared with data: the test copy's seed has no commission lines for Cavan or Sarah, so only the empty state was seen | S | Add example lines to the seed, then compare |
| Sales Performance | director, bd, sales, accounts | both | [P1] The page opens for admins only (the MD); the demo gives it to these roles (own row, or the director's team) | M | Scope rules and read access per role; `perf` is not built per role (loop 11) |
| Sales Performance | md | both | [P2] The "Collected %" column of the per-person table is missing | S | Small, but needs the collected figure per person in the load |
| Team Reports | md, director, accounts | both | [R1] Month is a select with the report status text ("Reviewed · submitted 23h late"); the app has previous/next arrows and short badges. The visits bar and the Outstanding column are missing | M | Outstanding needs a new figure per person |
| Director Report | md, accounts | both | [R2] The Sales Director's own monthly report (filed by Eddie, reviewed by the MD) is not built: no row for him, and he sees an empty state | L | New report kind, migration and review rule (loop 14 D6 covers the BD only) |
| Site report | site | both | [S1] The demo shows tiles for photo/video shooting and handover forms signed, an itinerary with a MOF no. column and a Print button per panel; the app has none of these | M | New figures and layout |
| People | md | both | [PE1] Demo table has Sales target, Visits / month, Customers and Open projects columns and a separate "Left the company" table (last day, customers handed to, reason); the app table has Email, Role (admin/staff) and Job role, and left people stay in it with "Left". Targets live inside Settings | M | Two target columns were tried and pushed Settings off the 1280 px card; needs a table redesign and customer and project counts per person |
| People | md | both | [PE2] The demo's "All targets" sheet (one grid for every person, years 2025-2027, monthly new-customers target) is missing; the app sets this year or next per person | M | New bulk editor and a new-customers target (migration) |
| People | md | both | [PE3] The "WhatsApp reminders" table (who is reminded, number, language, "Will be sent") is missing | M | WhatsApp sending is Integration (loop 22) |
| People | md | both | [PE4] The subtitle ("Add a new joiner with their role and target, or record a resignation...") is missing | S | The header's description slot is used for the "emails unavailable on your laptop" message |
| HR | md, accounts | both | [H1] Sales grades & bonus: the per-person table has no Notes column (demo: "e.g. promoted S1 to S2 from J") | M | Needs a notes column on `staff_hr_records` (migration) |
