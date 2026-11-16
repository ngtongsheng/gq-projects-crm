# 06 Parity: loop 18 Stock, Samples, Leftover (2026-11-16)

Test copy `gq-crm-dev`, `pnpm dev` in the worktree, demo on port 3112 ("Reset example data" first), Chrome profile "Agent".

## How it was run
- Legend: **V** compared visually (screenshots of the demo and the app) and by structure; **S** structure only (the
  `parity.md` snippet on both sides, plus button and column lists); **O** only checked for horizontal overflow; **A** app
  screenshot or measurement only; **-** not run. Checklist letters: Side = sidebar, Head = heading and subtitle, Tiles,
  Ctl = filters and controls, Tabs (the segment bar), Cols = table columns, Btn = buttons per role. ✓ matches, ✗ differs.
  `[ST1]`.. are rows in `docs/office-parity/drift-after-sweep.md`; "L21" is a line under "Loop 21, Stock, Samples and
  Leftover" in `docs/decisions.md`; "fixed" was fixed in this task.
- 1280: the Chrome window (1280 x 657). 390: Chrome will not shrink the window below about 500 px, so every 390 cell was
  loaded in a 390 px frame (media queries answer to the frame), app and demo both.
- People: md = Vicky, director = Eddie, bd = Vanessa, sales = Cavan, accounts = Jany, ssup = Jess (sales support who
  arranges stock), support = Wai Mun. Every role that sees these pages was run at both widths. Not run: marketing (the
  test copy has no Marketing person, only the vacant Marketing Exec) and a salesperson who arranges stock (only Jess
  does). Site roles do not see Stock (page registry; Awal's sidebar has no Stock).
- What each cell got: **Vicky** Stock, Leftover at 1280 and Leftover at 390 are V (the demo's Samples list is empty in its
  example data, so Samples is S plus the demo's source for columns). **Cavan** Stock at 1280 and 390 is V. **Jess** Stock
  at 1280 is V. The Email suppliers dialog is V (Vicky, 1280). Every other cell is S at 1280 and S plus O at 390
  (heading, counts, table scroll inside its card, page overflow 0 on all 21 app cells and all 21 demo cells at 390).
- The demo's reservation data differs from the seed everywhere (counts, names); that is never drift.
- Dialogs at 390 (Vicky): Email suppliers, Reserve stock, Settings, Paste from sheet, Add stock item, Use for project,
  Update, New pickup form, pickup Settings, Add sample, Take out: all 358 px wide with no horizontal overflow (O). Read
  through for content at 1280 only: Email suppliers (V), Use for project, Arrange transport, Mark collected, pickup form.

## Check first (loop 18 list, Stock, Samples, Leftover)
- Stock: tile labels and order, segment labels and (N) counts, Email suppliers dialog, status-cell notices: opened for all
  seven roles. Labels, order and notes match; "Expired - follow up" has a hyphen where the demo has an en dash (L21). The
  dialog works ("Mark as sent" took the tile from 2 to 0). Segment bar wraps to stacked rows at 390 px as the demo's does.
- Samples: `loadSamples` and the pickup embeds loaded for all seven roles. **Re-check of task 05's finding (pg-safeupdate,
  UPDATE without WHERE):** the next-form-no. save (`set_next_sample_pickup_number`), the settings save (`.eq("id", true)`)
  and a pickup save (`save_sample_pickup`, which also updates `sample_pickup_settings`) ran in the browser as the MD
  (with a stock row, SR-0010, 1 pc of UNJ-CT-37; the receipt opened), Sales Director, Purchasing, Sales support
  and HR & Accounts: all saved, no server error in `pnpm dev`. Salespeople and the Marketing Director see no buttons, as
  in the demo. Receipt: title block fits one A4 (751 px of 1032 px, 10 rows) (A). At 390 px the sheet scrolls inside its
  grey desk (task 05). **Fixed:** the toolbar title shrank to "P." beside the buttons at 390 px.
- Other UPDATE or DELETE without WHERE in these screens: none. A script over `src/**/*.ts*` found no `.update(` or
  `.delete()` without a filter (the only hit, `people/role-access-actions.ts`, filters with `.not(...)`); a second script
  over `supabase/migrations/*.sql` found only the four statements task 05 already fixed. The migrations test
  (`scripts/migrations-update-where.test.ts`) covers future updates; it does not cover deletes, which have none.
- Leftover: **server error for the Sales Director** (`/stock/leftover`: `mofs` null on a row whose MOF he cannot read).
  Fixed with `mofs!inner` in `leftover-data.ts` and `leftover-count.ts` (L21, [ST5]). `leftover_allocations(projects)`
  embed and count query: loaded for all seven roles after the fix. Supervisor RLS update: Awal marked MOF-2026-016's
  leftover collected ("Marked as collected"). Purchasing arranged its transport. Allocation: 1 pc saved as the MD; the
  form blocks 9 of 8 before the server (the server guard is in `allocation-actions.test.ts`). "Show sold out" reloads on
  click (1 item became 2). Dialogs at 390 px: O ✓.

## Stock (`/stock`)
| Person | Width | Side | Head | Tiles | Ctl | Tabs | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|---|
| Vicky (md) | 1280 | ✓ | ✓ "Stock reserved" after fix; ✗ subtitle | ✓ | ✗ buttons, no search or salesperson | ✗ extra "Stock items" | ✗ no Supplier column; ✗ clipped actions (fixed) | ✗ extra Download CSV, Add stock item; Settings, Paste, Email suppliers, Reserve ✓ | V ✗ | fixed, L21, [ST1] |
| Vicky | 390 | - | ✓ | ✓ | ✗ | ✗ | ✓ scrolls in card | ✓ | S+O (page overflow 0) | [ST1] |
| Eddie (director) | 1280 | ✗ 17 items vs 18 (Sales Performance, [P1]) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ no Settings | S | [ST1] [ST3] |
| Eddie | 390 | - | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | S+O | [ST3] |
| Vanessa (bd) | 1280 | count only (17) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ extra "Request a hold"; none in demo | S | L21, [ST1] [ST2] |
| Vanessa | 390 | - | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | S+O | - |
| Cavan (sales) | 1280 | count only (16) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ extra "Request a hold" | V ✗ other people's lines masked "Another salesperson's project" | [ST1] [ST2] L21 |
| Cavan | 390 | - | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | V ✗ same | [ST2] |
| Jany (accounts) | 1280 | count only (19) | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ none | S | [ST1] |
| Jany | 390 | - | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | S+O | - |
| Jess (ssup) | 1280 | count only (8) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ no Settings | V ✗ filters, supplier, Settings | [ST1] [ST3] |
| Jess | 390 | - | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | S+O | [ST3] |
| Wai Mun (support) | 1280 | count only (10) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ no Settings | S | [ST1] [ST3] |
| Wai Mun | 390 | - | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | S+O | [ST3] |

## Samples (`/samples`)
| Person | Width | Head | Tiles | Ctl | Tabs | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|---|---|
| Vicky, Eddie, Wai Mun, Jess, Jany | 1280 | ✓ (same words, colon for dash) | ✓ Sample SKUs, Taken out not back, None left | ✓ search, Product, Brand | ✗ extra "Stock items" | ✓ per the demo's source (10 columns; the app adds a pickup list below) | ✓ New pickup form, Add sample; ✗ "Paste from sheet" for "Paste from Excel"; ✗ extra Settings | Vicky A (demo list empty); others S | L21, [ST6] |
| Same five | 390 | ✓ | ✓ | ✓ | ✗ | ✓ columns drop Size / spec and Notes | ✓ | S+O (page overflow 0; list and pickup list scroll in their cards) | - |
| Vanessa, Cavan | 1280 | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ none, as the demo | S | - |
| Vanessa, Cavan | 390 | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | S+O | - |
| Pickup form dialog, receipt | 1280, 390 | - | - | ✓ fields as the demo's form | - | ✓ 10-row item table | ✓ Save & open PDF form | A (receipt 1280 and 390, dialog 1280, dialogs 390 O) | fixed (toolbar title), L21 |

## Leftover (`/stock/leftover`)
| Person | Width | Head | Ctl | Tabs | Cols | Btn | Shots | Logged |
|---|---|---|---|---|---|---|---|---|
| Vicky | 1280 | ✓ title and subtitle (roles for "Jess") | ✓ search, Show sold out; ✗ extra Search button | ✗ extra "Stock items" | ✓ Best Link 6 columns (was scrolling sideways 356 px, fixed); extra Returns table | ✗ no "+ Add leftover stock"; extra Download CSV, Paste; Use for project ✓ | V ✗ | fixed, L21, [ST4] |
| Vicky | 390 | ✓ | ✓ | ✗ | ✓ scrolls in card | ✓ | V (stacked cards, same pattern) | - |
| Eddie | 1280 | ✓ | ✓ | ✗ | ✓ (no rows: his MOFs only) | ✗ no Use for project (no rows) | S | fixed (server error), [ST5] |
| Eddie | 390 | ✓ | ✓ | ✗ | ✓ | ✓ | S+O | [ST5] |
| Wai Mun, Jess | 1280 | ✓ | ✓ | ✗ | ✓ | ✓ Use for project, Update, Arrange transport (extra) | S (Wai Mun also exercised: Arrange transport) | [ST4] |
| Wai Mun, Jess | 390 | ✓ | ✓ | ✗ | ✓ | ✓ | S+O | - |
| Jany | 1280 | ✓ | ✓ | ✗ | ✓ | ✓ no edit buttons, as the demo | S | - |
| Jany | 390 | ✓ | ✓ | ✗ | ✓ | ✓ | S+O | - |
| Vanessa, Cavan | 1280 | ✓ | ✓ | ✗ | ✓ | ✓ none | S | - |
| Vanessa, Cavan | 390 | ✓ | ✓ | ✗ | ✓ | ✓ | S+O | - |

## Fixed in this task (files)
- `src/app/(app)/stock/leftover/leftover-data.ts`, `leftover-count.ts`: `mofs!inner` (server error for the Sales Director).
- `src/app/(app)/stock/page.tsx`, `reservations-table.tsx`, `src/lib/i18n/zh-installation-stock.ts`: heading, wrapped
  columns, "N days held".
- `src/app/(app)/stock/leftover/best-link-table.tsx`, `returns-table.tsx`, `src/app/(app)/samples/samples-list.tsx`:
  wrapped long text so the tables fit at 1280 px.
- `src/components/app/print-layout.tsx`: toolbar title on its own row on a phone.

## Test copy changes (restored by the re-seed at the end)
Next pickup form no. set to 10, 20, 30, 40, 50; five pickup forms saved (SR-0010 took 1 pc of UNJ-CT-37); 1 pc of the
Orbis offcuts used for a project; supplier emails marked sent; MOF-2026-016's leftover collected and its transport arranged.
