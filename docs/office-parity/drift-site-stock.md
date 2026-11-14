# Drift: log work, site work, installation, stock, samples, leftover

Spec: `docs/mockup/gqp-office-demo.html`. Analysed 2026-11-14 against the app at `a8ddcaa`. In places the app is behind
the old demo too: `site_logs` has no installation %, measurement or shooting tracking; leftovers have no sold / keep-why.

## Log work (`vToday` ~2769): missing, L
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

## Site Work (`vSite` ~3301; ours `/site-work`, `/site-work/[mofId]`): major, L
- Seven tabs: Jobs (MOF, project, salesperson, stage + delivery status, installed %, last update, next on site);
  Site log (tiles per supervisor vs target, shootings, handover forms); Measurements (Submit → salesperson taps
  Received); Photos & videos (shooting requests, completed-photos tracker, "Saved to Drive" sheet); Actions needed
  (filter by owner group); Stock returns; Daily log & reminders (7-day grid planned vs done, reminder config for managers
  and support).
- Banner for new MOFs needing a first visit, "MOF summary" button, shooting-request sheet (sales, BD, MD, marketing).
- Stages unchanged (Start 10, On-going 25, Shipment 45, Delivered 60, Installation 80, Completed 100).
- New: `shoot_requests`, `site_off`. Marketing sees only Photos and Log tabs.

## Installation (`vInst` ~3802; ours `/installation`): major, L
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

## Stock (`/stock`): minor, S
- Segmented Reserved / Leftover / Samples, four tiles, table, "Paste from sheet", "Email suppliers (N)" with a
  supplier-notice flag.

## Samples (`vSamples` ~3452): missing, M-L
- `samples`: product, brand, SKU, name, qty, unit, spec, notes, in/out/adjust log. Table with select, qty at Best Link +
  who has some out, Take out / Back, "client keeps it". Paste from Excel.
- Pickup forms numbered SR-0001: "V-GQ SIGNATURE RECEIPT", bilingual 中文/English, person in charge, contact, method
  (Lalamove, Self pick-up, Transporter), date, driver, vehicle, address, up to 10 rows, signature, IC, received date.
  Saving deducts stock. Print / save as PDF; Chinese WhatsApp text for Best Link; Best Link number + Drive folder link
  as settings.
- Edit: purchasing, stock arrangers, accounts, marketing.

## Leftover / returns (`vLeftover` ~3565; ours `/stock/leftover`): major, M
- Statuses: Pending pickup, Collected by supervisor, Returned to supplier, At Best Link (for resale), Left with client,
  Disposed (ours lacks "Collected by supervisor").
- Return method; transport arranged by purchasing (Lalamove / lorry, date, cost, delivered to); supplier; keep-why
  (Indent from China, Custom made, GQ own stock, Salesperson ordered wrong + who, Others); WhatsApp sent; supervisor
  collected audit; `sold[]` allocations to another project ("Use for project": qty, date, note, available balance);
  defaults `suggestDest` / `keepWhyGuess`; "Show sold out" toggle. Credit note number, amount, who and when.

## WhatsApp hooks (config `db.remind`, nothing sent in the demo)
- Daily site log 17:00 to each supervisor with no log and no off entry, Mon-Sat (decided: follow the demo's Mon-Sat
  working week for site supervisors); next-morning 09:00 missing list to Vicky and Eddie. Weekly pending list Monday
  09:00; purchasing weekly to-do Monday 09:30; follow-up reminders 08:30 Mon-Sat, escalate after 3; task reminders.
  Per-person number and language; office WhatsApp number for balance stock.
