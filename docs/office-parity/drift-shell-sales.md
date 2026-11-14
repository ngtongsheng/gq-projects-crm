# Drift: shell, roles, dashboard, customers, calendar

Spec: `docs/mockup/gqp-office-demo.html` (the "demo"). Analysed 2026-11-14 against the app at `a8ddcaa`.
Line numbers refer to the demo file.

## Shell (`src/components/app/app-shell.tsx`, `src/app/(app)/layout.tsx`, `src/lib/auth/nav-sections.ts`)
- Drift minor. Navy header with mint marker, collapsible left sidebar, mobile drawer and tokens/fonts
  (Figtree, Saira, IBM Plex Mono) already match.
- Differences:
  - The demo has no module tabs in the header: logo, signed-in person, nothing else. Ours shows a "CRM" module tab row.
  - Sidebar order and grouping come from `tabsDefBase(role)` (~1925) and the render at ~5130-5145. Main pages first,
    then a `.nav-sep` divider, then Guide, then Performance, People, Tasks, Tools & Forms and Leave.
  - Icons are inline SVGs in the `IC` map (~5110-5140); copy them.
  - Nav badges: Dashboard (open ownership requests, managers), Sales Calendar (pending invitations), Costing
    (submitted low-margin quotes, md/director), Tasks (late + revision required + to review), Leave (awaiting my approval).
    Ours has only the ownership badge.
  - Mobile: scrim, collapsed state persisted in localStorage, sticky bottom FAB on Log work (`.lwfab`).
  - "View as" (VIEWAS, ~1799 and render ~5146): read-only, a purple sticky banner "Viewing as X · title", "Back to Y", and
    nothing is saved. Ours (impersonation) writes as the target and shows an amber bar.
  - Language: EN/BM toggle via `tr()` over `TT` (~2741), used on site-supervisor screens and Leave; separate EN/中文
    toggle (`CLANG`, `ZHEN` ~1912) for Costing only, default English. Noto Sans SC font for Chinese.
- Every role's tab list is in `tabsDefBase`, with labels that change per role (e.g. "MOF Register" vs "My Sales",
  "Team Reports" vs "My Report", site role labels in BM).

## Roles and access (cross-cutting, size L)
- Demo roles (`PEOPLE0` ~1455): md, director, bd (titled "Marketing Director"), sales, accounts, site, ssup (sales
  support), support (purchasing), marketing, designer. The app has 7 job roles; ssup, marketing and designer are missing.
- Person flags: `sells` (site supervisor who also sells, e.g. Sarah: gets customers, projects, collection and commission),
  `arrange` (sales + sales support, maps to our `arranges_stock`), `margin` (sees cost and margin), `left`/`leftWhy`/
  `active:false`, join date, per-year sales targets prorated by join/leave date, `handTo` + handover list when leaving,
  `email`, WhatsApp number, language.
- Teams: salespeople carry a `lead` (Eddie or Vanessa). `leadOf`, `teamOf`, `myTeam`, `inTeam`, `TF`, `tmC`, `tmP`
  (~1809-1816) scope what directors and BD see. md and accounts see all. `isMgr` includes a BD with team members.
- Access matrix: `PAGES` (21 pages), `ACCESS0` defaults, `accAllowed(roleKey, page)` (~1939-1954). MD always allowed.
  Overrides per role key are edited by MD in People ("What each role can see"), plus a "See margin % and cost" row.
  Defaults: sales, arrange and director lose `mof`; site loses `cost`.

## Dashboard (`/`)
- Variants (`vDash` ~1961): `dashMof` (support, ssup, md toggle "MOF & projects"), `dashMgr` (director, md "Sales
  activity"), `dashPersonal` (sales, bd), `dashTasks` (designer, marketing).
- New banners: tasks, appointment invitations, visit outcomes not logged (last week), leave approvals, site log missing,
  stock-return transport to arrange, costings below min margin, collection >90 days (commission cut warning),
  shooting/measurement received, planned calls today, site follow-ups. "Plan a call" button on the personal dashboard.
- Manager views scoped by team. Accounts may approve overtime.
- Most banners depend on later modules; build the banner slots with the module that feeds them.

## Customers / Companies (`/customers`)
- Drift major (pre-existing: the old demo had it too). The demo has a Companies / All people toggle. Companies table:
  Company, Type (+ rating, account), Salespeople, People, Last visit, Status (Active / Quiet / No visit Nd). A row opens a
  company sheet: people, visits, Edit company, Add person, Log visit. Filters: search, salesperson, type, status.
- Ours: only the flat contact table. No company list or company sheet.
- Visibility team-scoped (`tmC`). Up to 2 owners per company; only owners add people. "Request a customer" for sales/bd
  (ours: `/customers/ownership`).

## Sales Calendar (`/calendar`)
- Drift major. Views: Week, Monthly list, Weekly outcomes (ours: Month / Week).
- New: appointment invitations (`inv[]` Pending/Accepted/Declined, dashed-yellow events, "+ Eddie ?" tags, badge);
  "Plan a call" + today's-calls banner; on-leave strip per day; "Log outcome" flag; outcome requires result,
  learnings (15+ chars), optional project lead, records late logging and creates a follow-up; "Who" filter "My team".
- Weekly outcomes: Mon-Sun navigator, per salesperson visits done/logged/not logged/late, results, new leads, weekly
  report status, expandable visits, "Mark reviewed" by md or team lead, salesperson "Submit weekly report" (due Friday).
- New data: activity invitees, outcome fields (result, lead, late_logged, logged_at), weekly_reports (who, week, note,
  status, reviewed_by, reviewed_note, late), deadline setting.
