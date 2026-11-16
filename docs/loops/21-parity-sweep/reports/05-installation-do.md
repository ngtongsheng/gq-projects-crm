# 05 Parity: loop 18 Installation and delivery orders (2026-11-16)

Test copy `gq-crm-dev`, `pnpm dev` in the worktree, demo on port 3112 ("Reset example data" first), Chrome profile "Agent".

## How it was run
- Legend: **V** compared visually (screenshots of the demo and the app) and by structure; **S** structure only (the
  `parity.md` snippet run on both sides, plus flags for which buttons and panels appear); **O** only checked for
  horizontal overflow; **A** app screenshot only (the demo side read from its source); **-** not run. Checklist
  letters: Side = sidebar, Head = heading and subtitle, Ctl = filters and controls, Tabs, Cols = table columns, Btn =
  buttons per role. ✓ matches, ✗ differs. `[IN1]`..`[DO1]` are rows in `docs/office-parity/drift-after-sweep.md`; "L21" is
  a line under "Loop 21, Installation and delivery orders" in `docs/decisions.md`; "fixed" was fixed in this task.
- 1280: the Chrome window (1280 x 657). 390: Chrome will not shrink the window below about 500 px, so every 390 cell was
  loaded in a 390 px frame (media queries answer to the frame), both sides.
- People: md = Vicky, director = Eddie, bd = Vanessa, sales = Cavan, accounts = Jany, site = Awal, site who sells =
  Sarah, ssup = Jess (sales support who arranges stock), support = Wai Mun. Marketing and designers do not see
  Installation (page registry), so they were not run. Every role that sees Installation was run at both widths.
- Structure was run for all nine people x three views (Installers/week, Site supervisors, Installer contacts) x both
  widths, both sides, and read back (buttons present, filters, columns, panels, overflow). Visual pairs were taken for
  the cells marked V below; everything else in those grids is S plus overflow (0 px on every cell, both sides).
- Test copy changed by the check (restored by the re-seed at the end): DO no. 9205 issued, one DO item line saved,
  Awal's booking confirmed. The next DO number was not changed beyond the seed (saving 9205 as 9205 only proves the
  permission).

## Check first (loop 18 list)
- `delivery_orders` `jobs!inner` embed with `.eq("jobs.status","done")` ("DOs not yet signed"), the paged `jobs` read,
  `salespeople()`, the grouped Select, `supervisor_only` in `JOB_COLUMNS`: Installers, Site supervisors and Contacts
  opened for all nine people. **Server error for Eddie and Vanessa** (ZodError, `mofs` null: a job whose MOF they cannot
  read). Fixed: `mofs!inner` in `calendar-jobs.ts` and `unsigned-do-data.ts`, so those jobs are left out (L21, [IN2]). ✓ after.
- DO: nested `mofs(projects(contacts(companies(address))))` embed: the DO print page rendered with bill-to, deliver-to,
  site PIC and office PIC. `delivery_order_lines` `delivery_orders!inner`: delivery log on the MOF Register and the DO
  items dialog opened. `replace_delivery_order_lines`: saved one line (`saveDoLines` 200). `delivered_to_date`: loaded
  with the DO items dialog, no error. ✓
- RPCs `issue_do_number` and `set_next_do_number`: **both write a one-row table with no WHERE clause. Supabase refuses
  it ("UPDATE requires a WHERE clause").** `set_next_do_number` failed in the browser ("Could not save"); `issue_do_number`
  has the same statement (not run before the fix). New migration `20261119120000_numbering_where_clause.sql` applied to the
  test copy; after it Purchasing and HR & Accounts saved the next number (unchanged value) and Purchasing issued 9205 to
  a delivery. The two samples functions had the same statement and are fixed in the same migration (task 06 should
  re-check them in the browser). Test added: `scripts/migrations-update-where.test.ts`. Fixed, L21.
- Print preview fits one A4: sheet content 929 px against 1032 px available (297 mm less 2 x 12 mm), 12 rows. ✓ (measured,
  not printed.)
- Roles: a Site Supervisor answers only their own booking (Awal's list held only Awal's rows; Confirm worked). Purchasing
  and HR & Accounts can set the next DO number (saved); the MD has the button too. The site role has no Edit and no
  Settings, so it cannot issue a DO number. Sales, sales support, directors have no Settings. ✓

## Installation, Installers view (`/installation`, calendar, "DOs not yet signed")
| Person | Width | Side | Head | Ctl | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ (S) | ✗ "Installation" fixed to "Installation calendar" and subtitle | ✓ installer, supervisor; ✗ extra Month/Week, "Show" | ✗ list not grid, no "Coming up" | ✗ no booking banner; extra Settings | V ✗ list vs 7-col grid | fixed, [IN3] [IN4] [IN5] L21 |
| Vicky | 390 | - | ✓ after fix | ✓ | - | ✓ Book, Schedule job | V ✗ (stacked list vs grid, shell header SW5) | [IN5] |
| Eddie (director) | 1280 | ✓ (S) | ✓ after fix | ✓ | ✗ no "Coming up" | ✓ Book, Schedule job; ✗ no banner | S | [IN3] [IN4] |
| Eddie | 390 | - | ✓ | ✓ | - | ✓ | V (Site supervisors view, see below); Installers S+O | - |
| Vanessa (bd) | 1280 | ✓ (S) | ✓ | ✓ | ✗ no "Coming up" | ✓ Book only | S | [IN2] [IN3] |
| Vanessa | 390 | - | ✓ | ✓ | - | ✓ | S+O | - |
| Cavan (sales) | 1280 | ✓ (S) | ✓ | ✓ | ✗ | ✓ Book only | V ✗ demo masks others' jobs "Other job"; app shows MOF and client | [IN2] |
| Cavan | 390 | - | ✓ | ✓ | - | ✓ | V ✗ same | [IN2] |
| Jany (accounts) | 1280 | ✓ (S) | ✓ | ✓ | ✗ | ✓ no Book, no Schedule; ✗ no banner; extra Settings | S | [IN4] |
| Jany | 390 | - | ✓ | ✓ | - | ✓ | S+O | - |
| Awal (site) | 1280 | ✓ (S) | ✓ | ✗ no installer-supervisor filter; own jobs only | ✗ | ✗ no Schedule job; ✓ banner | V ✗ own jobs only, no grid | [IN1] [IN2] |
| Awal | 390 | - | ✓ | ✓ | - | ✗ no Schedule job | V ✗ | [IN1] |
| Sarah (site, sells) | 1280 | ✓ (S) | ✓ | ✓ | ✗ | ✗ no Schedule job | S | [IN1] |
| Sarah | 390 | - | ✓ | ✓ | - | ✗ | S+O | [IN1] |
| Jess (ssup) | 1280 | ✓ (S, nav "Delivery & Installation") | ✓ | ✓ | ✗ | ✗ no Schedule job, no banner | S | [IN1] [IN4] |
| Jess | 390 | - | ✓ | ✓ | - | ✗ | V ✗ no Schedule job, no banner | [IN1] [IN4] |
| Wai Mun (support) | 1280 | ✓ (S) | ✓ | ✓ | ✗ | ✓ Schedule job; ✗ no banner; extra Settings | S | [IN4] |
| Wai Mun | 390 | - | ✓ | ✓ | - | ✓ | S+O (Site supervisors view V below) | - |

## Installation, Site supervisors view (`?tab=supervisors`)
| Person | Width | Head | Ctl | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|
| Vicky | 1280 | ✓ after fix | ✓ supervisor chips (demo: chips with colour legend) | ✓ Date, Supervisor, Purpose, Booked by, Status | ✗ no Schedule job in the head | V ✗ week list vs 7-col grid | [IN5] [IN6] |
| Eddie | 1280 | ✓ | ✓ | ✓ | ✗ no Schedule job | S | [IN6] |
| Eddie | 390 | ✓ | ✓ | - | ✗ no Schedule job, no banner | V ✗ | [IN4] [IN6] |
| Vanessa, Cavan | 1280 | ✓ | ✓ | ✓ (seed has bookings for them) | ✓ Book | S | - |
| Vanessa, Cavan | 390 | ✓ | ✓ | table drops "Booked by" | ✓ | S+O | - |
| Jany | 1280 | ✓ | ✓ | ✓ | ✓ none (demo: none) | S | [IN4] |
| Jany | 390 | ✓ | ✓ | - | ✗ no banner | V ✗ (demo frame rendered a tall header; content compared) | [IN4] |
| Awal | 1280 | ✓ | no supervisor filter (own only) | ✓ own rows, Confirm / Decline | ✗ no Schedule job | S | [IN1] |
| Sarah | 1280 | ✓ | ✓ | no table rows (none for her) | ✓ | S | - |
| Jess | 1280 | ✓ | ✓ | ✓ | ✗ | S | [IN1] |
| Wai Mun | 1280 | ✓ | ✓ | ✓ | ✗ no Schedule job in head, no banner | S | [IN6] [IN4] |
| Wai Mun | 390 | ✓ | ✓ | - | ✗ | V ✗ | [IN6] [IN4] |
| Awal, Sarah, Jess | 390 | ✓ | ✓ | table drops "Booked by" | - | S+O | - |

## Installation, Installer contacts (`?tab=contacts`)
| Person | Width | Head | Ctl | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|
| Vicky | 1280 | ✓ after fix | ✓ search, show inactive | ✓ 7 columns, same order | ✓ Add installer | V ✓ (app adds WhatsApp links per phone, same as demo's 💬) | L21 |
| Eddie, Wai Mun, Awal, Sarah, Jess | 1280 | ✓ | ✓ | ✓ | ✓ Add installer (demo: same set) | S | - |
| Vanessa, Cavan, Jany | 1280 | ✓ | ✓ | ✓ | ✓ no Add installer | S | - |
| Vanessa | 390 | ✓ | ✓ | ✗ 3 columns (demo scrolls 7) | ✗ no Book (demo: in the head) | V ✗ | L21 (deliberate), [IN6] |
| Sarah | 390 | ✓ | ✓ | ✗ 3 columns | ✓ Add installer, ✗ no Schedule job | V ✗ | L21, [IN1] [IN6] |
| Others | 390 | ✓ | ✓ | ✗ 3 columns | ✓ | S+O | L21 |

## Job form (Edit delivery / Schedule job dialog) and DO numbering
| Person | Width | Screen | Head | Ctl | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|
| Vicky | 1280 | Edit delivery | ✓ "Edit job" / "Edit delivery" | ✓ MOF, job type, team (grouped, Supervisor only), supervisor, DO no. + Issue DO no. now, transporter, DO date, partial/final, passed to supplier, signed; ✗ items table not in the form | ✓ | V ✓ top half (demo sheet vs app dialog) | [DO1] |
| Wai Mun | 1280 | Issue DO no. now, save | ✓ | ✓ DO no. 9205 issued | ✓ | A | - |
| Wai Mun, Jany | 1280 | Next DO running number dialog | ✓ title, hint, field, Save | ✓ field holds the seed number | ✓ Save, Close | S (text vs demo source) | L21 |
| Wai Mun | 1280 | DO items dialog (MOF page) | - | ✓ product, code, description, qty, unit, covers, batch, "ordered" line | ✓ Add line, Copy products from the MOF, Save items | A (demo has the table in the job sheet) | [DO1] |
| Wai Mun | 390 | Edit delivery, DO items, numbering dialogs | - | - | - | O ✓ (358 px wide, no overflow); DO items dialog A | - |

## DO print (`/installation/do/[jobId]`)
| Person | Width | Head | Content | Btn | Shots | Logged |
|---|---|---|---|---|---|---|
| Vicky | 1280 | ✓ "DO ..." bar | ✓ logo and address, DELIVERY ORDER, DO no., date, page, bill to, deliver to, delivery date, client PO, job / quote no., salesperson, site PIC and contact, office PIC and contact, 12-row table, total, notes, acknowledgement, both signature blocks, thank-you line; warning "Check before printing" for payment check and pre-approval | ✓ Print / Save as PDF; "Back" (demo "Close") | A + source read (demo needs items saved in the demo; its print could not be opened without lines) | L21 |
| Wai Mun | 390 | ✓ | the sheet kept its A4 width and made the whole page scroll sideways by 101 px (fixed: it now scrolls inside the grey desk, page overflow 0) | ✓ | A after fix | fixed, L21 |

## Delivery log (MOF Register, `/mofs`)
| Person | Width | Head | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|
| Vicky | 1280 | ✓ "Delivery log" with "N DOs · M delivered, not yet signed · next running no. 9205" | ✓ 14 columns in the demo's order (DO no., MOF no., Company, Project, DO date, Transporter, Job scope, Partial / full, DO passed to supplier, DO signed & returned, Items, Remarks, Project delivered?, edit) | ✓ Change, Schedule delivery | V ✓ header and first rows | [M1] (own tab in the demo) |
| Wai Mun | 390 | ✓ | table scrolls inside its card | - | O ✓ page overflow 0 | - |
| Jany, Vicky (other widths) | - | - | - | - | - (same page as task 02) | - |

## Fixed in this task (files)
- `calendar-jobs.ts`, `unsigned-do-data.ts`: `mofs!inner` (server error for director and bd).
- `supabase/migrations/20261119120000_numbering_where_clause.sql` and `scripts/migrations-update-where.test.ts`.
- `page.tsx`, `supervisor-bookings.tsx`, `installer-contacts.tsx`, `installation-params.ts` (+ test): heading, subtitle, week default.
- `src/components/app/print-layout.tsx`: print sheet scrolls inside its desk on a phone.
