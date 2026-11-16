# Drift: log work, site work, installation, stock, samples, leftover

Spec: `docs/mockup/gqp-office-demo.html`. Analysed 2026-11-14 against the app at `a8ddcaa`. Log work and Site Work
were built in loop 17 and Installation, Stock, Samples and Leftover in loop 18 (see their headings). Browser parity for
both loops is still to run after go-live (see the checklists below).

## Log work (`vToday` ~2769): DONE (loop 17; browser parity after go-live)
Built: site role landing page, 4-step wizard, away days (Leave / MC through the Leave module, office and other here),
banners (follow-ups, missed days, planned but unrecorded), stage moves on logging, BM strings. Deviations:
`docs/decisions.md` "Loop 17". Gaps left:
- No "Didn't go" option (no table for it yet).
- Balance stock is only a typed answer (`return_answer`); items, quantity, unit and return method wait for loop 18.
- The office WhatsApp number setting is not read: the link opens WhatsApp and you pick the chat.
- `photos_to` is not set (no sales-support setting yet).
- Server-action messages and WhatsApp texts stay English.
Original drift, kept for reference:
- Mobile-first wizard, landing page for the site role. Site nav: Log work, My schedule, Site Work, My Report, My claims,
  Tasks, Leave (BM labels via `tr()`).
- Home: month visit counter vs target, "Jobs planned for you" (installs + bookings), "Already recorded", Leave / MC /
  office button, banners (follow-ups, missed days, planned but unrecorded).
- Step 1: pick an MOF, or "new site, no MOF yet" (salesperson + site name, optional pipeline project).
- Step 2: multi-select activities: Inspection, Measurement, Delivery, Installation, Shooting, Handover, Touch Up, Stock
  return (no "Others"). Ours is single-select with "others".
- Step 3 per activity: Installation % done (warn if lower than last); Measurement sent to salesperson y/n; Shooting
  posted y/n; Delivery all OK or problem; Handover form signed + 4+ completed photos posted; Balance stock items, qty,
  unit, return method (installer, transport, supervisor); Problem: follow-up owner (Client, Charge, Purchasing,
  Installer), due date, note.
- Step 4: saved, WhatsApp deep link to the office with the stock-return text. Sticky bottom FAB on phones.
- Logging moves the site stage: installation % maps to 60 + 0.35×pct (cap 95); signed handover → Completed;
  delivery → Delivered.
- New data: site-log columns `inst_pct`, measurement (to, sent_at, received), shooting (to, sent, saved, link),
  completed photos, return answer; `site_off` (leave, MC, office, public holiday, other; date range; MC photo);
  follow-up assignee + "still waiting" log with snooze 1/2/5 workdays; logs without MOF (free-text site + sales).
- Photos/videos are NOT uploaded: they go to a WhatsApp group; sales support pastes a Drive folder link on the MOF.
  The only upload here is the MC slip (image downscaled to 1100 px, PDF max 1.5 MB).

## Site Work (`vSite` ~3301; ours `/site-work`, `/site-work/[mofId]`): DONE (loop 17; browser parity after go-live)
Built: all seven tabs, new-MOF banner, MOF summary button, shooting requests, Saved to Drive, follow-up owner and still
waiting with snooze, reminder settings, BM strings. Deviations: `docs/decisions.md` "Loop 17". Gaps left:
- Stock returns has no count and only the statuses Sent back and To return (loop 18).
- Daily log has no Leave / MC button on a missing cell; the support team sees "before joined" and leave days as Missing
  (`leave_people()` is manager-only).
- Tables are not scoped per salesperson (RLS gives read to all).
- No Submit button for unsent measurements or unposted shootings (logs are never edited).
- The Drive link is stored on the log, not on the MOF.
- Reminders are settings only; nothing is sent (Integration).
Original drift, kept for reference:
- Seven tabs: Jobs (MOF, project, salesperson, stage + delivery status, installed %, last update, next on site);
  Site log (tiles per supervisor vs target, shootings, handover forms); Measurements (Submit → salesperson taps
  Received); Photos & videos (shooting requests, completed-photos tracker, "Saved to Drive" sheet); Actions needed
  (filter by owner group); Stock returns; Daily log & reminders (7-day grid planned vs done, reminder config for managers
  and support).
- Banner for new MOFs needing a first visit, "MOF summary" button, shooting-request sheet (sales, BD, MD, marketing).
- Stages unchanged (Start 10, On-going 25, Shipment 45, Delivered 60, Installation 80, Completed 100).
- New: `shoot_requests`, `site_off`. Marketing sees only Photos and Log tabs.

## Browser parity still to run (after go-live)
Not run in loop 17: the new migration was not on the test copy. Like loop 16, run it per `parity.md` in Chrome profile
"Agent", on desktop and at 390px, for each role that sees Log work and Site Work. Check first:
- `loadSiteJobs` embeds and `loadMonthLogs`.
- `loadSiteActions` and `loadStockReturnLogs`.
- The `app_settings` read for `site_reminders`.
- The `mofs` query filter `.not("site_logs.inst_pct","is",null)` (an embedded filter, unproven on the test copy).
- The `shoot_requests` embed on `mofs`.
- RPC permissions (leave and follow-up functions) for the site role and for support.
- The marketing Photos & videos view (only two tabs).
- The sticky bottom bar at 390px against the demo (`lwfab`).

## Installation (`vInst` ~3802; ours `/installation`): DONE (loop 18; browser parity after go-live)
Built: three views (Installers calendar with installer and supervisor filters and the unsigned-DO panel, Site supervisors
bookings, Installer contacts directory), the `installers` table and backfill, job form team picker with Supervisor only,
DO numbering with void list, DO items with delivered-to-date, A4 DO print, delivery log on the MOF Register. Deviations:
`docs/decisions.md` "Loop 18". Gaps left:
- No "Coming up" table and no Team size.
- Site supervisors is a day-by-day week list, not a 7-column grid. No Cancel on a booking (no cancelled status).
- Phone is required to save an installer.
- Renaming an installer does not rewrite the name on old jobs (`docs/debt.md`).
- DO items are edited in a dialog on the MOF page, not in the job form.
Original drift, kept for reference:
- Views: Installers calendar (filter by installer and supervisor, "DOs not yet signed & returned" panel); Site
  supervisors (booking Requested / Confirmed / Declined with reply); Installer contacts directory (name, company, two
  phones with WhatsApp links, skills, area, notes, job count, last job, active). `jobs.installer` is free text today.
- DO numbering: the app issues DO numbers. `nextDO()` = max(used, voided) + 1, seed 5541, shown as MOF no + 4 digits
  (e.g. P15915547). "Issue DO no. now" on the job; Done blocked until a DO number exists. Deleted DO numbers go to a void
  list, never reused. md, purchasing or accounts set the next number once (must exceed the last used).
- DO lines: product, code, description, batch, unit, qty, covers; delivered-to-date per item (`delivBefore`).
- Printable DELIVERY ORDER (A4): bill-to, deliver-to, client PO, salesperson, site PIC + contact, office PIC, 12-row
  table, partial / final, acknowledgement signatures. `doSup` (passed to supplier), `doDate`. Warns when the MOF payment
  check or DO pre-approval box is not ticked. Delivery log on the MOF register (14 columns).
- Job form extras: team incl. "Supervisor only", salesperson in charge, remarks.

## Stock (`/stock`): DONE (loop 18; browser parity after go-live)
Built: four tiles, four segments (Reserved for clients, Stock items, Leftover at Best Link (N), Samples at Best Link (N)),
"Paste from sheet" (already there), Email suppliers (N) with the notice flag. Gaps left: the draft opens in the email app
with To empty (supplier addresses are not stored); "Stock items" stays as a fourth segment.
Original drift, kept for reference:
- Segmented Reserved / Leftover / Samples, four tiles, table, "Paste from sheet", "Email suppliers (N)" with a
  supplier-notice flag.

## Samples (`vSamples` ~3452; ours `/samples`): DONE (loop 18; browser parity after go-live)
Built: SKU list with search, filters, tiles, Take out / Back / client keeps it, paste from sheet, SR-0001 pickup forms that
deduct stock, bilingual A4 receipt, Best Link number + Drive folder + next number as settings. Gaps left:
- A pickup row over stock is refused (the demo clamped it to 0).
- No delete button for a pickup form (the database allows it).
- The samples list is not paged (debt).
Original drift, kept for reference:
- `samples`: product, brand, SKU, name, qty, unit, spec, notes, in/out/adjust log. Table with select, qty at Best Link +
  who has some out, Take out / Back, "client keeps it". Paste from Excel.
- Pickup forms numbered SR-0001: "V-GQ SIGNATURE RECEIPT", bilingual 中文/English, person in charge, contact, method
  (Lalamove, Self pick-up, Transporter), date, driver, vehicle, address, up to 10 rows, signature, IC, received date.
  Saving deducts stock. Print / save as PDF; Chinese WhatsApp text for Best Link; Best Link number + Drive folder link
  as settings.
- Edit: purchasing, stock arrangers, accounts, marketing.

## Leftover / returns (`vLeftover` ~3565; ours `/stock/leftover`): DONE (loop 18; browser parity after go-live)
Built: Collected by supervisor status, return method, transport arranged, supplier, keep-why, WhatsApp sent, supervisor
collection (Mark collected on the Site Work MOF page), Use for project allocations with available balance, Show sold out,
credit note. Gaps left:
- "+ Add leftover stock" without a MOF is not built (a MOF is still required).
- Allocations are add-only (no edit or delete).
- No transport banner; the status cell shows the transport instead.
Original drift, kept for reference:
- Statuses: Pending pickup, Collected by supervisor, Returned to supplier, At Best Link (for resale), Left with client,
  Disposed (ours lacks "Collected by supervisor").
- Return method; transport arranged by purchasing (Lalamove / lorry, date, cost, delivered to); supplier; keep-why
  (Indent from China, Custom made, GQ own stock, Salesperson ordered wrong + who, Others); WhatsApp sent; supervisor
  collected audit; `sold[]` allocations to another project ("Use for project": qty, date, note, available balance);
  defaults `suggestDest` / `keepWhyGuess`; "Show sold out" toggle. Credit note number, amount, who and when.

## Browser parity still to run, loop 18 (after go-live)
Not run in loop 18: its eight migrations (20261118100000 to 20261118170000) were not on the test copy, so nothing here was
proven against real Supabase, only in PGlite. Run `parity.md` in Chrome profile "Agent", desktop and 390px, for each role
that sees Installation, Stock, Samples and Leftover. Check first:
- Installation: the `delivery_orders` `jobs!inner` embed with `.eq("jobs.status","done")`, the paged `jobs` read, the
  `salespeople()` RPC, the grouped Select, `supervisor_only` in the `JOB_COLUMNS` queries.
- DO: the nested `mofs(projects(contacts(companies(address))))` embed, the `delivery_order_lines` `delivery_orders!inner`
  filter, and the RPCs `next_do_number`, `delivered_to_date`, `replace_delivery_order_lines`, `issue_do_number`,
  `set_next_do_number`. Print preview fits one A4.
- Stock: tile labels and order, segment labels and the (N) counts, the Email suppliers dialog, status-cell notices,
  segment wrap at 390px.
- Samples: `loadSamples` and pickup embeds, `save_sample_pickup` and the numbering RPCs, the settings update
  `.eq("id", true)`, receipt title wrap and one-A4 fit.
- Leftover: the `leftover_allocations(projects)` embed, the count query, supervisor RLS update, the allocation guard
  message, "Show sold out" auto-submit, dialogs at 390px.
- Roles: supervisor can answer only their own booking; support and accounts can set the next DO number; site role cannot
  issue DO numbers.
- Before the first live DO: Vicky sets the next DO number once (the loop seeds 5541).

## WhatsApp hooks (config `db.remind`, nothing sent in the demo)
- Daily site log 17:00 to each supervisor with no log and no off entry, Mon-Sat (decided: follow the demo's Mon-Sat
  working week for site supervisors); next-morning 09:00 missing list to Vicky and Eddie. Weekly pending list Monday
  09:00; purchasing weekly to-do Monday 09:30; follow-up reminders 08:30 Mon-Sat, escalate after 3; task reminders.
  Per-person number and language; office WhatsApp number for balance stock.
