# GQP Office demo: OLD -> NEW change spec

OLD = docs/mockup/gqp-office-demo.html (5509 lines). NEW = docs/loops/25-claims-marketing-samples/assets/gqp-office-demo.html (moved to docs/mockup/ by task 01) (5925 lines).
Raw `diff` has only 7 hunks (NEW lines 1928-1940, 3061-3065, 4350-4758 added block, 5559, 5770-5772). Everything else is byte-identical.

## 0. Key finding: owner list vs. actual diff
| Owner item | Actually changed? |
|---|---|
| 1. Travel claim monthly summary (`vTClaims`, `tcOf`...) | YES, new code. Old claim code is left in the file but unreachable (see 1.9) |
| 1. HR standard packages per position, outstation rules | NOT changed. Identical in OLD (`hrStdPanel`, `sheetHrStd`, `hrOsPanel`, `sheetHrOs`, `OS0`, `STD_PKG0`, `clCap`, `hotelCap`). Only the claim form now reads them (documented in 1.8) |
| 2. Marketing expense page (`vMkt`) | YES, all new |
| 3. Custom samples page (`vTuft`) | YES, all new |
| 4. Installer contacts (phone, skills, area; new installers in job + PO lists) | NOT changed. Identical in OLD (`instDir`, `sheetInstaller`, `instSync`, `INST_SKILLS`, `INST_SEED`); documented in section 4 for completeness |

## A. Access matrix / sidebar (all roles)
Source: `tabsDefBase(r)` (default tabs per role), `PAGES` (toggle list in People > access), `tabsDef()` (applies `db.access` overrides; md always sees all of its base + Tools), `ACCESS0` default overrides = {sales:{mof:false}, arrange:{mof:false}, director:{mof:false}, site:{cost:false}} (unchanged). `canPage(k)`.
Role keys (`ROLE_OPTS`, `roleKey`): sales, arrange (= sales + `arrange` flag, uses sales tabs), designer, marketing, ssup (Sales support), site, support (Purchasing), accounts, director, bd (Marketing Director), md.
People in demo: Jany=accounts, Jess=ssup, Wai Mun=support, Lisa=support(inactive), Affifa/Liza=designer, "Marketing Exec"=marketing (inactive, vacant), Vicky=md, Eddie=director, Vanessa=bd.

New / changed tab keys by role (default, before overrides):
| Page key | Sidebar label | md | accounts | director | bd | sales/arrange | site | ssup | support | designer | marketing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `tuft` | Custom samples | Y | Y | Y | Y | Y | n | Y | Y | Y | Y |
| `mkt` | Marketing expense | Y | Y | n | n | n | n | Y | Y | n | Y |
| `claims` | md/accounts/director: "Travel claims"; bd/sales: "My travel claim"; site: "My claims" (not renamed) | Y | Y | Y | Y | Y | Y | n | n | n | n |
| `hr` | HR | Y | Y | n | n | n | n | n | n | n | n |
- `PAGES` (access toggle list) changed: added `["tuft","Custom samples (loan)"]`, `["mkt","Marketing expense"]`; renamed claims `"Claims (commission & travel)"` -> `"Travel claims (monthly)"`. So md can grant `tuft`/`mkt`/`claims` to any other role via the access matrix.
- `tuft` position in sidebar: after Stock (default branch) / after Stock (support, marketing) / after Stock (ssup) / directly after Dashboard for designer.
- `mkt` position: for md/accounts it is pushed after Director Report and before HR (`t.push(["mkt",...])` in `tabsDefBase`).
- Sidebar icons: `IC` map has NO entries for `tuft` or `mkt`; `svg(k)` falls back to the Dashboard icon (cosmetic bug).
- Router (`render()`): `{tuft:vTuft, mkt:vMkt, claims:vTClaims, ...}`. Click router (`document click`, near line 5770): added `tfClick(a,t)`, `mkClick(a,t)`, `tcClick(a,t)` before the old handlers.
- Read-only role: `readOnly()` = role is `accounts`. Jany therefore is READ-ONLY on `mkt` (no add/edit/delete/import/export/categories) and cannot borrow/admin custom samples; but she is the main actor on travel-claim release (`clCanManage()` = md or accounts; claim buttons are not hidden by CSS `body.ro`).

## B. Dashboard reminders (`weeklyItems(n)`; changed lines ~3061-3065)
Replaced old lines:
- Old "claim (commission & travel) not submitted" -> New: `"<Month> travel claim not submitted – cut-off <date>. Print it and attach the receipts."` Shown when `clCanClaimExp(n)` and this month's (`clMonth(TODAY)`) `tcOf(n,cm)` is missing or `Draft`, and days to cut-off <= 10. Uses `tcOf` instead of `clOf`; no longer checks "Returned".
- Old md/accounts "N monthly claims to approve / passed to you by Jany" REMOVED. New: only for role `accounts` (not md): `"N travel claim(s) ready to release (monthly report submitted)"` = `tclaims` with status `Submitted` and `tcRep(c)` truthy.
- New custom-sample reminders:
  - Borrower (any person n with an open loan, not marked returned): when due within 3 days or overdue: `Return custom sample <code> <name> (<cust>) – due <d> / overdue since <d>`.
  - Persons with role designer, ssup or md: `Confirm custom sample(s) received back: code (who), ...` when any loan has `retAt`; and `N custom sample(s) overdue – WhatsApp to return: code (who), ...`. (Roles support/marketing/director are admins on the page but get no reminder.)
- New marketing reminder, role accounts or md only: `Prepaid balance low – top up: <vendor> RM x, ...` (`mkPreLow()`); only when `db.mkt` exists.

## 1. Travel claim (page key `claims`, view `vTClaims`)
Title: manager "Travel claims", others "My travel claim". Data: `db.tclaims[]`. New data model is separate from old `db.mclaims` (no migration; old claims no longer visible).

### 1.1 Who sees what
- Page visible to: md, accounts, director, bd, sales/arrange, site (see A). Claimant eligibility `clCanClaimExp(n)`: role sales/bd/director/site, or `p.sells` flag.
- Manager = `clCanManage()` = md or accounts. Managers get "All claims" list; if the manager is also an eligible claimant they get a seg toggle `tcView`: "All claims" / "My claim". Non-managers: always "mine". (`vTClaims` sets `S.tcView`.)
- Director sees title "Travel claims" (because tab label uses `mgr` = md/director/accounts) but only their own claim.
- Month selector `#tcM`: `tcMonths()` = claim month of today (`clMonth(TODAY)`) + 5 previous months (6 options). Option label "Nov 2026 (26 Oct – 25 Nov)". Claim month rule `clMonth(d)`: day <= cut-off(25) -> that month, else next month. Period: `tcFrom(m)` = day after previous month cut-off, to `clCutDate(m)`.
- Cut-off: `clCfg().cut` (default 25; demo seeds 25). Its edit UI (old `clSettings`) is no longer reachable (see 1.9).

### 1.2 My claim form (`tcMine(n)`), form `#tcF`
Fields (all RM, number, min 0, step 0.01; disabled when status Released):
| id | Label | Notes |
|---|---|---|
| `tc_petrol` | Petrol + parking + toll (TNG) total | right side shows "Entitlement" = `clCap(n)`: "up to RM x a month" and red "over by RM y" if petrol > cap; "Not set – Jany sets it in HR" if cap = 0 |
| `tc_outst` | Outstation allowance total | hint: Breakfast/lunch/dinner RM `osCfg()` b/l/d per day. Manual total; NOT computed from meals |
| `tc_hotel` | Accommodation – hotel total | hint: "Your budget: up to RM `hotelCap(n)` a night" (hint only) |
| `tc_others` | Others – bought for the company | |
| `tc_od` | What was bought (text) | required if `others` > 0 |
| `tc_ot` | Overtime – approved OT claim | shown ONLY if person role is `site` |
| `tc_rm` | Remark (textarea) | placeholder: outstation trips, why over entitlement |
Computed: live "Total claim" `#tcTot` = petrol+outst+hotel+others+ot (`tcTot(c)`; input listener on `#tcF`).
Info lines: if `final` set and != total: warn banner "Final amount after Jany's check: RM x – note"; else if `janyNote`: "Jany: note". "Monthly report <Mon>: <status text from repStatus>" + " – Jany releases the claim only after it is submitted" when report not Submitted/Reviewed.
Status pill (`tcSt`): Draft/none "Not submitted" | Released "Released <date>" (good) | Submitted & report ok "Ready to release" (info) | Submitted & no report "Wait for report" (warn).
Buttons: primary submit (hidden when Released): label "Save & submit to Jany" (status != Submitted) or "Update" (already Submitted); "🖨 Print claim form" (`tcPrint`, only if the claim record exists).
Submit validation (document `submit` handler, `#tcF`): at least one amount > 0 ("Key in at least one amount"); if `others`>0 then `othersDesc` required ("Write what was bought"). No validation against cap, hotel budget, report status, cut-off date, or month being past/future. Empty field stored as "" (not 0).
Transition: (none)/Draft -> `Submitted` (`subAt`=today first time). Re-submit while Submitted = "Update" (`updAt`=today), status stays Submitted. Toasts: "Submitted to Jany – print the form and attach the receipts" / "Claim updated". Person can keep editing until Released.
Defaults: `tcOf(n,m,true)` creates {status:Draft, petrol/outst/hotel/others/ot "" , othersDesc "", remark ""}.

### 1.3 Accounts list (`tcAll()`), shown to md/accounts in "All claims"
Header: month select, "N ready to release". Rows = all active people with `clCanClaimExp`, in PEOPLE order, one per person (blank row if no claim).
Columns: Name | Petrol+toll | Limit (`clCap`, "—" if none; red bold if petrol > limit) | Outstation | Hotel | Others | Total (= `tcPay(c)`: final amount if set, else computed total; includes OT but OT has no own column) | Vicky ok ("✓ <date>" from `c.vicky`) | Report (pill "✓ Submitted"/"✓ Reviewed"/"Not yet" using `repStatus(repKind(who),who,m)`) | Claim (`tcSt`).
Row click (`tcOpen`) only for rows with status != Draft. Footer hint: tap row to check against printed form and receipts.

### 1.4 Check / release sheet (`sheetTc(id)`), md + accounts
Read-only summary: dl of Petrol (+ entitlement and "over by"), Outstation, Hotel, Others (+ description), Overtime (if >0), **Total claimed** (original, `tcTot`), Remark banner.
Editable (disabled once Released):
- `#tf` Final amount to pay (RM, min 0, step 0.01) default = `final` if set else total. Saved as "" when blank or equal to total.
- `#tv` checkbox "Verified with Vicky": on save sets `c.vicky` = existing date or today; unticking clears.
- `#tn` Jany's note (shown to the person).
- Banner: report status of claim month: good "can release" / warn "hold the claim until it is submitted".
Buttons (status != Released): `Return` (danger), `Save`, `Release claim` (primary; `disabled` while `tcRep(c)` null), always `🖨 Print`. Released: pill "Released <date> by <name>".
Actions (`tcClick`):
- `Save`: `keep()` stores final/note/vicky; toast "Saved". Does not change status.
- `tcRet` Return: `keep()`, then status -> `Draft`, toast "Returned to <name>". No reason field except the Jany's note; no "Returned" state; person sees "Not submitted" and can edit/resubmit (old `subAt` kept).
- `tcRel` Release: blocks with toast "Monthly report not submitted yet" if `!tcRep(c)`. Then `keep()`. If Vicky box not ticked: first tap shows red msg "Not yet verified with Vicky. Tap Release again to release anyway." (`confirm0`, flag `#m.dataset.warned`); second tap releases. On release: status `Released`, `relAt`=today, `relBy`=me; toast "Claim released". Terminal state (no un-release).
- Who: sheet opens for md and accounts only (`tcOpen` only rendered in `tcAll`).
Report gate `tcRep(c)`: report for the SAME claim month (`c.m`) must have status Submitted or Reviewed in `db.reports|sreports|dreports` (kind via `repKind`: site->sreports, director/bd->dreports, else reports). A "Not joined yet" person has no report object -> can never be released.

### 1.5 Print form (`printTc(id)`, via `formShell`, button available to both claimant and managers)
Title "Monthly travel claim · <Month Year>". Header table: Name | Position (title before " (") ; Claim period "<from> – <cut-off>" | Submitted (`subAt`). Section "Summary": table No. / Item / Amount (RM): the 4 `TC_F` lines (others line appends " – <description>", petrol line appends "(entitlement RM x)") + "Overtime (approved OT)" if >0. Row "TOTAL CLAIM". If final != total: row "Final approved amount". Remark box if remark. Fixed paragraph: all original receipts (petrol, parking, toll/TNG statement, hotel, others) attached; confirmation of truth. Signature table: Claimed by (Name prefilled) | Checked by (Accounts) | Approved by (Vicky), each with Signature/Name/Date. Receipts are paper only; no uploads.

### 1.6 Computed values
`tcTot` = petrol+outst+hotel+others (via `TC_F`) + ot. `tcPay` = final if set else `tcTot`. `tcFrom(m)` = clCutDate(prev month)+1. Limit = `clCap(n)` (1.8).

### 1.7 State machine
Draft(none) --person submit--> Submitted --Jany/Vicky Release (needs report Submitted/Reviewed; Vicky tick soft-warns)--> Released. Submitted --Return--> Draft. No Approved/Checked/Paid/Returned states.

### 1.8 HR packages / outstation rules (UNCHANGED from OLD, used by claim form)
- HR page (`hr`, md + accounts): views Policies & schemes / Staff packages / Sales grades & bonus. Staff packages view starts with `hrStdPanel()` then `hrOsPanel()`.
- Standard packages (`STD_PKG0`, `db.pkgStd`, `sheetHrStd(k)`): keys `sales` ("Salesperson package": Car allowance RM300 + Office parking allowance RM100; cap RM500) and `site` ("Site supervisor package": Motor / car allowance RM300; cap RM500). Editable fields: list of fixed allowances (type from `ALLOW_TYPES`, amount) + "Petrol + toll + parking claim max / month (RM)" (step 10). Saving does not change recorded packages.
- Person's cap `clCap(n)`: person package `pkgNow(n).cap` if set, else standard package of `stdKeyOf(n)` (site->site; sales,bd->sales; director/md/others -> none -> 0 = "Not set"). Per-person cap input in staff package sheet (placeholder "e.g. 500–700"), so "by position" is only two standard keys + per-person override.
- Outstation rules (`OS0`, `db.osCfg`, `sheetHrOs`): meals per day Breakfast RM10, Lunch RM15, Dinner RM25 (fixed, no receipt); hotel budget/night by level (`HL_LBL`): staff (Salesperson/site supervisor) RM100, manager RM150, director RM180. Level `hotelLvl(n)`: package `hl` override, else role director/bd/md -> director, else grade starting "M" -> manager, else staff. `hotelCap(n)`.

### 1.9 REMOVED from the old travel-claim flow (code still in file, unreachable)
Old `vClaims` page is no longer routed (router maps `claims` -> `vTClaims`). Dead but present: `vClaims, clMine, clAll, clAppeals, clSettings, sheetClOpen, sheetClExp, printClaim, clSubmitFor, clFlags, clClick` and `db.mclaims`.
Removed behaviours:
- One claim = commission + travel + OT; now travel only. Commission section (select projects at 90%+ paid, late-collection cut display) removed from claim; `Commission` page still has md/accounts-only "Record commission claim" button (`sheetClaim`, `canPay()`); salespeople have no self-claim action anywhere.
- Per-line travel expense entries (`CL_TYPES`: Petrol, Toll, Parking, Outstation meals, Hotel, Outstation, Mileage, Grab/taxi, Meal, Others; `+ Add` sheet with date, type, km, nights, meals checkboxes, amount, receipt photo/PDF `slip`), receipt numbering R1, R2 (`clRno`), "Original receipts received" tick (`origRecv`).
- Itinerary cross-check (`dayItin`, `clFlags`): flags "nothing logged this day", hotel/night over budget, meals twice a day, km/day over 150, petrol/toll/parking over cap, travel over monthly standard.
- Cap rule "over the cap, needs Vicky's approval" -> now only red "over by" text.
- OT section: auto-pulled approved OT entries (`clOtList`, `db.ot`, hours, "OT claim" vs replacement leave, `otAmt`) -> replaced by one manual OT amount (site role only).
- Note to Jany field and the late-collection **Appeal** (`clAppeal`, `sheetAppeal`, `clAppeals` view, `clDecide`, "special approval/favour" decision) -> no UI to appeal or decide pending appeals; `favourTag` still renders on Commission page.
- Per-line amount adjustment with original vs final (`orig`, `adjBy`, `clSaveAdj`, `clOFbox`) -> single Final amount + note.
- Statuses Draft/Submitted/Checked/Approved/Returned/Paid and 3-step flow (Jany checks -> passes to Vicky "Checked" -> Vicky/Jany Approves -> Jany Paid with `paidIn` salary month, `late` after-cut-off flag, `log` history) -> Draft/Submitted/Released.
- Return with mandatory "What to fix" text (`clRet`) -> Return with no reason prompt.
- Settings view (`clSettings`, `db.claimCfg`): cut-off day (1-28), mileage rate (RM/km, 0.6), km/day standard (150), monthly travel standard (RM), "needRep" (claim only after previous month's report submitted), and the late-collection thresholds/deductions (`db.commRule` late1/cut1/late2/cut2). The cut-off value 25 still comes from `db.claimCfg.cut` but has no editor. (Late-collection thresholds: check if another editor exists via `data-act="commRule"` on the Commission page; it does.)
- Submit gate "submit last month's report first" (`clSub`, `repDone`) -> none at submit; the report gate moved to release and uses the same month's report.
- "Earlier claims" history table, month tabs (this/previous), "All" list with "not submitted yet" names, md-first ordering, "Open" button.
- Dashboard md notification "claims passed to you by Jany to approve" and the "Returned" reminder case.

## 2. Marketing expense (page key `mkt`, view `vMkt`)
Visible: md, accounts, ssup, support, marketing (default). Edit rights: everyone except `accounts` (`readOnly()` hides Import/Export/Add/Edit categories/+ buttons and delete). Data: `db.mkt` = {exp[], evt[], pre[], give[], vendors[], events[], cats[], preAlert{}, seeded, importedAt/By}; `mkDb()` creates and seeds 3 example expense rows (INV-001 RM450 Full Piece Sample, courier RM85, stickers RM320, dated in current year) once.
Page header buttons (non read-only): "⬆ Import Excel" (`mkImp`), "⬇ Download Excel" (`mkExport`). Segmented views `S.mkV`: Dashboard (default) | Expense log | Vendors & part-timers | Events | Prepaid accounts | Sample give-away.
Year `mkY()` = `S.mkY` or current year. Currency amount in RM = `mkRM(x)` = `x.rm` if >0 else (amt if currency RM/blank else 0).

### 2.1 Expense log (`mkExpView`, `sheetMkExp`)
Toolbar: month filter `#mkM` (months present), category filter `#mkC` (categories + any legacy ones), search `#mkQ` (desc, vendor, ref, event, remarks), "+ Add expense". Header shows "N lines · RM total". Sorted by date desc, id desc.
Columns: Date | Category | Description (+event line) | Vendor | Invoice / ref | Amount (currency prefix if not RM) | RM | Payment | Remarks. Row click -> edit sheet.
Form fields: Date* (date, default today) | Category* (select of `mkCats()`, default first) | Description* | Vendor* (text + datalist of vendors) | Invoice/ref no. | Currency (RM, USD, RMB, EUR, SGD, Others; default RM) | Amount* (number >0, step .01) | Amount in RM* (shown only when currency != RM; for RM auto-copied from Amount) | Event (select of events `mkEvOpts`, blank "— Not for an event —"; stored in `camp`) | Payment method (MK_PAY: Bank transfer default, Company card, Cash, Prepaid / deposit, Petty cash, Others) | Remarks.
Validation: date, description, vendor, amount>0 ("Fill in date, description, vendor and amount."); RM amount >0 ("Key in the amount in RM."). Save stores `by/at` (new) or `updBy/updAt`. Delete button (edit only, no confirm).

### 2.2 Dashboard (`mkDash`)
Low-balance banners per vendor (`mkPreLow`) with "Open" -> prepaid view. Tiles: Total spend <year>; Average / month (total / months with spend); Highest month (+name); Last month (previous month of today, 0 if other year). Year select `#mkY` (years in data + current). Button "Edit categories" (non read-only).
Table "By category and month": rows = `mkCats()` + legacy cats on expenses; 12 month columns + Total; TOTAL row; "Change vs previous month" row (▲ red up / ▼ green down %, only when both months > 0). Cell click (`mkCell`) -> Expense log filtered by that category+month (note: previous search text `mkQ` is not cleared).
Chart `mkChart`: 12 stacked bars (one segment per category, fixed 11-colour palette `MK_COL` cycling for >11 categories), total label above bar (k for >=1000), legend of categories with spend.
Vendors panel (`mkVendors`): top 10 (button "Show all N"): # | Vendor | Mainly for (top category) | Invoices | Total | % | bar; click -> expense log filtered by vendor.
Events panel (only if event-sheet costs exist): per event total of event-sheet lines (`M.evt`) + row "Marketing log + events" = year log total + event-sheet totals (expense-log lines tagged to events are already in log total).

### 2.3 Categories (`sheetMkCats`) default `MK_CAT0` (11): Folder, Full Piece Sample, Wallpaper Book, Printing & Stationery, Graphic Design & Branding, Digital Marketing, Logistics & Courier, Events & Exhibitions, Wallpaper Design, Merchandise & Gifts, Others. User actions: rename inline (renaming moves existing expenses on Save), + Add category ("New category"), move up (no move-down), delete (disabled while any expense uses it; shows "N used"), "Older categories still on expenses" panel with target select + Move (applies immediately and saves, ignoring Cancel). Validation: no empty names; no case-insensitive duplicates. Saves to `db.mkt.cats`.

### 2.4 Vendors & part-timers (`mkVendView`, `sheetMkVend`)
Tabs All / Companies / Part-timers (N); search `#mkVq` (name, type, contact, note, email, skills); sort A–Z / Highest spend; buttons "+ Add part-timer", "+ Add vendor". Companies are auto-added from vendor names on expenses and prepaid entries (`mkVSync`, `auto:1`).
Columns: Name (+Part-timer pill, note) | Supplies / skills (pills; part-timer rate under) | Contact (contact person, phone link + WhatsApp 💬 `waPh`, email, Portfolio link) | Invoices <year> | Total (YTD, by case-insensitive vendor-name match in expense log, year `mkY`) | Last paid (latest expense date). TOTAL row.
Form: toggle Company/Part-timer; Name* (unique case-insens.); company: What they supply (`MK_VTYPE`: Samples & catalogues, Folders & sample boards, Printing, Design & branding, Digital marketing, Courier & logistics, Events, Merchandise, Others), Contact person; part-timer: Skills checkboxes (`MK_SKILL`: Graphic design, Video shooting, Video editing, Photography, Social media, Copywriting, Others), Rate (free text), Portfolio link; both: Phone/WhatsApp, Email, Notes. Part-timer requires phone OR email. Rename cascades to expenses and prepaid entries. Delete only when no expense uses the name. "See payments" jumps to expense log searching the name. Part-timers are paid by logging an expense with their name as vendor (no separate payment record).

### 2.5 Events (`mkEvtView`, `sheetMkEvent`, `sheetMkEvt`, `printMkEvt`)
Events list (`M.events`) auto-created from names in event costs or expense Event field (`mkEvSync`). If none: "Create the event first". Event form: name* (unique), start, end, venue, budget (RM, step 100), notes; rename cascades; delete only if no costs/expenses reference it.
"All events" table (if >1): Event(+venue) | Date range | Items | Budget | Cost (red if cost > budget). Selected event (`#mkE`): header with dates/venue/notes, Edit event link, "+ Create event", "🖨 Print / PDF", "+ Add cost". Tiles: Total event cost (red if over budget; sub "Budget RM x · over by / left" or "No budget set"); Cost items (+ "N from expense log"); Biggest cost group. Event cost = event-sheet lines (`M.evt`) + expense-log lines tagged to that event (shown with "Expense log" pill; group = category; edit opens expense sheet).
Tables: Summary by cost group (Group | Total | % | bar | TOTAL) and All cost items grouped by group with subtotal: Description | Supplier/ref | Foreign amt | Rate (RM) | Unit | Qty | Total | Remarks.
Cost form: Event*, Cost group* (free text + datalist), Description, Supplier/ref, Foreign amount (free text, e.g. "RMB 2700"), Rate (RM)* (step .01), Unit (default "ls") + Qty (default 1), Remarks. Total = round(rate x qty, 2). Validation "Choose the event and fill in cost group and rate."
Print (`printMkEvt`, `formShell` "Event costing · <name>"): section Summary by cost group (Group | Total | %) with TOTAL; section Cost items (Group | Description | Supplier/ref | Foreign amt | Rate | Unit | Qty | Total) with TOTAL <EVENT>; footer "Printed <date> by <me>".

### 2.6 Prepaid accounts (`mkPreView`, `sheetMkPre`, `sheetMkPreAlert`, `printMkPre`)
Concept: advance paid to a vendor (e.g. the Europe designer); each job deducts. One account per distinct vendor name in `M.pre`. Buttons "+ Top up" and "+ Deduct a job".
Account tiles: vendor, balance (= topped up − used; red if < 0 or below alert), "Topped up", "Used (N jobs)", "Used in <currency>" sums, "of which marketing (F.O.C)", "Last top-up <date>". Low: `alert>0 && balance<alert` (alert per vendor in `db.mkt.preAlert[v]`; 0 = off), tile border red + "below RM x – top up soon". Click tile selects vendor.
Statement (`mkPreStatement`, vendor select or All): Date | (Vendor) | Client – project | MOF/ref | Foreign amt | Top-up | Used | Running balance (red if negative) | Marketing? | Remarks. Entries ordered by vendor then entry id (NOT by date). Top-up rows tinted. Row click -> edit.
Entry form: Date* (default today), Vendor* (text + datalist; typing a new name creates a new account), Description (top-up) or "Client – project*" (deduction), Foreign amount (currency EUR default; EUR/USD/RMB/SGD/RM + amount), Top-up (RM)* or Used (RM)* (>0), live "Rate: RM x per CUR", MOF/ref, checkbox "Marketing cost (F.O.C, not charged to client)" (deductions only), Remarks, "Balance now" hint for new deductions. Validation: date, vendor, RM amount>0; client–project required for deductions. Toast shows new balance and "– low, top up soon". Delete (no confirm). The sheet kind (top vs use) is fixed by button; editing keeps kind by `!!+x.top`.
Alert sheet ("Low-balance alert" per vendor): "Warn when balance is below (RM)"; hint says account turns red and Jany/Vicky see a reminder.
Print statement: header table Topped up | Used | Balance; Entries table Date | Client–project | MOF/ref | Foreign | Top-up | Used | Balance (running, by id); "Printed <date> by <me>".

### 2.7 Sample & catalogue give-away (`mkGiveView`, `sheetMkGive`)
Cost register only (not linked to Custom samples). Search `#mkGq` (supplier, invoice, item, given-to). Columns: Date | Supplier | Invoice no. | Item | Given to (client/project) | Qty | Unit cost | Total (RM). Form: Date* (today), Supplier (datalist), Item*, Invoice no., Given to* (datalist of contact companies), Qty (default 1), Unit cost (RM). Total = round(qty x unit, 2). Validation "Fill in date, item and who it was given to." Delete no confirm. Not included in dashboard totals.

### 2.8 Excel import/export (SheetJS from cdnjs, loaded on demand `loadJs(XLSX_URL)`; needs internet)
Import (`sheetMkImp`): .xlsx/.xls file, checkbox "Replace what is in the app now (untick to add on top)" default checked. Detects sheets by header row whose first cell is "Date" or "Cost group": (a) expense: columns Date, Category, Campaign / event, Description, Vendor, Invoice / ref no., Currency, Amount, Amount (RM), Payment method, Remarks (rows with no date and no amount skipped); (b) prepaid: Date, Vendor, Description / project, Ref / MOF, Top-up (RM), Used (RM), Marketing? (starts with y), Remarks; (c) give-away: Date, Supplier, Invoice no., Item, Given to (client / project), Qty, Unit cost, Total (RM); (d) event sheet (sheet name = event name): Cost group, Description, Supplier / ref, Foreign amount, Rate (RM), Unit, Qty, Total (RM), Remarks (rows without group or total skipped). Rows whose first cell starts "Total" are skipped. Dates accept Excel serials, Date objects, dd/mm/yyyy, yyyy-mm-dd. Replace mode overwrites exp/evt/pre/give only. Toast counts imported lines. Error if nothing found or library fails to load.
Export (`mkExport`): `GQ_Marketing_Expense_<today>.xlsx` with sheets Expense Log (adds Month column), one sheet per event (name cut to 31 chars), Vendors (Vendor, Type, Skills, Rate, Portfolio, Supplies, Contact, Phone, Email, Notes, Vendor total YTD), Prepaid & Deposits, Sample Give-away. Uses `DL.save` when available else anchor download.

## 3. Custom samples (page key `tuft`, view `vTuft`)
Data: `db.tufts[]` (seeded once with TS-001 "Example – Botanical swirl", on loan to Vernice, due 2 days ago; TS-002 available), `db.tuftCfg.days`. Code prefix "TS-".
### 3.1 Roles
- See page: all except site (by default); see A.
- `canTfAdmin()` (not readOnly and role in md, designer, support, ssup, marketing, director): Record new sample, Edit, Settings, Delete, confirm/deny return, WhatsApp remind, give away any sample, "Received back" directly.
- `canTfBorrow()` (not readOnly and `isSeller(me)` [role sales/bd/director or `sells`] or role md/director/bd): Borrow button.
- Accounts: view only. Designer: admin but cannot borrow (not a seller). Borrower = `loan.who`.
### 3.2 Status (`tfSt`): "Given away" (x.gift set) > "Returned – to confirm" (open loan has `retAt`) > "On loan" > "Available". Overdue (`tfOver`): open loan with no `retAt` and due < today = days overdue; row tinted red, pill "Overdue Nd".
### 3.3 List
Page header: "+ Record new sample" and "Settings" (admins). Tiles: Available | On loan (counts loans not gifted; "N with you") | Overdue (click filters; red if >0; "past <days> days – WhatsApp to return") | Returned – to confirm (only if any) | Given away. Toolbar: search `#tfQ` (code, design no, name, supplier, note, customer, salesperson); filter `#tfF`: All in hand (default, excludes given away) / Available / On loan / Overdue / Returned – to confirm / Borrowed by me / Given away. Sort: most overdue first, then received date desc.
Columns: photo thumb | Sample (code mono, design no · name) | Supplier · size (· N pcs if qty>1) | Received (+recorded by) | Status pill (+ "<who> returned <date>") | With / client (salesperson, customer – project; or "to <gift customer>") | Return by | actions: Borrow (Available & canTfBorrow), return buttons (`tfBtns`), "💬 Remind" (overdue & admin; link `https://wa.me/<number>?text=<tfWaText>`; number from `waNo(l.who)` = Reminders WhatsApp setting; if missing toast "No WhatsApp number for X – add it in Reminders"). Row click -> detail sheet.
WhatsApp text (`tfWaText`): "Hi <who>, reminder from GQ office: the custom sample *<code (design)> <name>* you borrowed on <date> for <customer> – <project> was due back on <date>. Please return it to the office as soon as possible. Thank you!" Clicking sets `reminded++`, `remAt` (not shown anywhere).
### 3.4 Record / edit sample (`sheetTfRec`, admin)
Fields: Sample code (default next `TS-###` = max numeric + 1; unique, blank -> auto) | Received date* (default today) | Design name / description* | Design no.* | Supplier (datalist of prior suppliers) | Size (free text) | Qty (pcs, int >=1, default 1) | Photo (file image, camera capture, resized to max 1100 px JPEG 0.7 via `readSlip`, stored as data URL) | Notes. Hidden defaults: `by`=me, `loans`=[]. Validation: "Fill in the design no., design name and received date."; duplicate code "<code> is already used." Delete (edit only, only when no loans and not gifted; no confirm). Toast "<code> recorded – salespeople can now borrow it".
### 3.5 Borrow (`sheetTfBorrow`, status Available only)
Fields: Salesperson* (select of active sellers; shown only when borrower is an admin non-seller, else = me) | For which customer* (text + datalist of own/unowned contacts' companies; admins see all) | Project | Borrow date (default today, editable, no range check) | Return by (read-only = borrow date + `TF_DAYS()` loan days, default 14, recalculated on date change). Validation: customer required; "Already on loan." Creates loan {who, cust, proj, out, due, back "", by}. Toast "<code> borrowed by <who> – return by <date>". Loan period change (Settings `tfCfg`, int >=1) does not alter existing loans.
### 3.6 Return (2-step) (`tfBtns`, `tfClick`)
1. Borrower (loan.who === me, and not admin) taps "I've returned it" (`tfRet`): sets `retAt`=today; status -> "Returned – to confirm"; shows "Waiting for designer to confirm". Overdue stops counting immediately.
2. Admin taps "✓ Received back" (`tfBack`): loan `back`=today, `backBy`=me -> Available; or "Not received" (`tfNoRecv`): removes `retAt`, appends log "not received in office", back to On loan (and overdue again if past due).
Admins also see a one-step "Received back" button on any open loan (no borrower step needed). An admin who is also the borrower (md, director) only gets the admin buttons, so they can confirm their own return in one step.
### 3.7 Give away (`sheetTfGift`, button "Give away…" in detail sheet)
Allowed when not yet gifted and (admin or current borrower). Fields: Given to (customer)* (prefilled from loan customer) | Reason* (textarea, min 5 chars). Validation "Key in who it was given to and the reason." Effect: open loan gets `back`=today, `gift`=true; `x.gift` = {date, to, reason, by}; status "Given away"; no undo; not editable/deletable afterwards.
### 3.8 Detail sheet (`sheetTfOpen`)
Header code · name, status pill, received date (+by); photo; kv: Supplier, Design no., Size (+pcs), Notes, With (salesperson for customer – project, borrowed date, return by red if overdue), Given away (date, to, by, reason). "Loan history" table (newest first): Salesperson | Customer (+project) | Out | Back (date / "Given away" / pill "due <date>" red if overdue). Buttons: Edit (admin), Give away…, "💬 WhatsApp <who>" (overdue & admin), return buttons, Borrow.

## 4. Installer contacts (UNCHANGED in NEW vs OLD; reference only)
Located on Installation page (`inst`), `iView==="dir"` (`instDir`), data `db.installers`. `instSync()` (called at start of `render()`) rebuilds global `INSTALLERS` (+ "N/A") and `TEAMS` (+ "Supervisor only") from ACTIVE installers, so new installers appear in: job scope/installer selects (MOF sheet `#mi`), installer PO sheet (`#xi`, excludes N/A), installation calendar team/filter, and column-grid selects.
Who edits: `canInstDir()` = not readOnly and (canInst, isMgr, md/support/accounts) -> accounts excluded by readOnly. Columns: Installer (+company, Inactive pill) | Phone (tel link + WhatsApp 💬 via `waPh`) | What they can do (skill pills + description) | Area | Notes | Jobs | Last job. Search, "Show inactive" toggle, "+ Add installer".
Form (`sheetInstaller`): Name* (unique case-insens.), Company, Phone* (required), Phone 2, Skills (`INST_SKILLS`: Carpet tile, Broadloom carpet, Vinyl tile / sheet, SPC / laminate, Timber, Wallpaper, Wall panel, Sports flooring, Edging / trims, Epoxy / screeding, Others), What they can do (textarea), Area covered, Team size, Notes, Active checkbox (edit only; inactive removes from lists). Rename cascades to installs (`team`), projects `installer`, `installerPOs`. Seeds: `INST_SEED`.
Existing PO rules (unchanged): one PO per installer per MOF; max two installers per MOF.

## 5. Other changes in the diff
- Sidebar tab list/labels: see A (claims label rename; `tuft`/`mkt` insertion). Designer tab list now Dashboard, Custom samples, Tasks, Leave. Marketing role: Dashboard, Marketing expense, Tasks, Site photos, Stock, Custom samples, Leave. Support: ..., Stock, Custom samples, Marketing expense, Tasks, Leave. ssup: ..., Stock, Custom samples, Marketing expense, Tasks, Leave.
- Router, click-delegation hooks, `PAGES` list (A).
- No changes to: Commission, HR, Installation, Costing, Collection, Reports, Leave, Tasks, Site, Stock, Tools screens, People/access screen logic, data seed/migration blocks (no migration for `tclaims`, `tufts`, `mkt`; they self-seed/initialise lazily).

## 6. Contradictions / unclear rules
1. Release gate month: `tcRep` uses the report of the SAME claim month. Monthly report for month m is due first Monday of m+1 (`dueDate`), so release waits until after month end. OLD gate was the PREVIOUS month's report at submit time. Confirm which month is meant.
2. "Verified with Vicky" is advisory: Release works after a second tap without the tick (`confirm0`). Owner wording implies it should be required.
3. Final amount can go stale: person may "Update" a Submitted claim after Jany set a final amount; `final`/`janyNote`/`vicky` are not reset. List "Total" column shows `tcPay` (final) while sheet "Total claimed" shows the original.
4. Return puts status back to `Draft` (not "Returned") with no required reason; the person sees "Not submitted" and the dashboard reminder logic (Draft within 10 days of cut-off) is the only prompt.
5. Limit/cap is by position only for sales and site (2 standard packages); director/md have no standard cap -> "Not set". Cap and hotel budget are display-only warnings; nothing blocks submit or release. Hotel total is not checked against nights x budget (no nights field). Outstation total is free-typed, not derived from meal rates.
6. Director sees tab "Travel claims" (manager label) but is not a manager. Site role tab label is still "My claims". Site eligible for OT field only by `role==="site"`; a site supervisor who "sells" has no commission claim path in claims page.
7. Commission: claims page text says "Commission is claimed separately on the Commission page", but there is no self-service claim; only md/accounts `Record claim`. Late-collection "Appeal"/"special approval" flow lost its entry point; any Pending appeals in data cannot be decided; HR policy text seeded in `hrSeed` (`hrExtra`, "Monthly claim (commission + travel + OT)... explanations or appeals go in the note... Jany checks... approved by Jany or Vicky... OT approved by Eddie, Vicky or Jany") still describes the OLD flow and the appeal.
8. Cut-off day 25 is no longer editable (settings view removed) but still read from `db.claimCfg.cut`.
9. Old `db.mclaims` data (submitted/paid claims) is orphaned: no screen shows it, no migration to `tclaims`.
10. Accounts (Jany) is `readOnly()`: she cannot add/edit marketing expense, import/export, edit categories, or maintain vendors/prepaid, yet owner text implies Jany/Vicky run the money side. Low-balance "Low-balance alert" button is NOT gated by readOnly (inconsistent). Vanessa (Marketing Director, `bd`) and Eddie have no `mkt` access by default.
11. md does not receive the "ready to release" reminder (accounts only), though md can release.
12. Custom samples: 2-step return is bypassable (admin one-step "Received back"; md/director borrower self-confirm). Overdue stops counting once borrower taps returned. Gift has no undo. Borrow date editable to any date (can backdate to dodge overdue). Salesperson-less roles: marketing/support admins get no dashboard reminders. Owner says "designer records sample" but admin set also includes md, director, support, ssup, marketing.
13. Two different "give-away" concepts: Marketing "Sample give-away" cost register and Custom samples "Give away" (customer + reason). They are not linked; gifted custom samples create no marketing cost.
14. Marketing: prepaid usage (including "Marketing cost F.O.C" entries) is excluded from dashboard totals/charts; prepaid statement orders by entry id, not date (back-dated entries show out of date order; running balance follows entry order). Vendor delete check only looks at expenses, not prepaid entries (auto re-created next sync). Foreign-currency expense without RM amount is rejected by form but counts 0 if imported. Import "Replace" does not clear vendors, events (budget/venue), categories or prepaid alerts; export does not include event budget/venue, categories, prepaid currency/foreign amount or alerts, and import ignores the Vendors sheet -> round trip loses data. Import without replace has no duplicate detection. Excel needs internet (cdnjs).
15. Deletes in marketing, custom samples (tfDel) and vendors have no confirmation; category "Move" action saves immediately even if the sheet is cancelled.
16. Sidebar: `tuft`/`mkt` use the Dashboard icon (no icon defined).
17. Installer-contacts and HR packages/outstation rules appear in the owner's change list but are NOT part of this diff (already in OLD). If the owner expects them to differ, the spec source is mismatched.
