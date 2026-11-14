# GQP Office parity roadmap

Vicky's demo `docs/mockup/gqp-office-demo.html` is the spec for screens, flows and rules (her message, 2026-11-14).
The UI follows the demo as exactly as possible. Data relationships, backend and logic reuse what the app has wherever
they fit. Drift found on 2026-11-14 is in the four `drift-*.md` files here; `parity.md` is how a screen is checked.

## Rules for every parity loop
- UI: copy the demo's layout, order, labels, columns, controls and states per role. Deviate only where the demo cannot
  work for real (shared data, server permissions) and log the deviation in `docs/decisions.md`.
- Where the demo contradicts itself, follow the more specific rule and log it. Site supervisors work Mon-Sat.
- Data: extend existing tables before adding new ones. New tables get RLS for every job role in the same migration.
- Every UI task's acceptance includes a parity check per `parity.md` for each role that sees the screen.
- Anything account-bound is code or env (see `docs/handover-migration.md`): it must move to Vicky's accounts unchanged.
- At most 2 loops run at once (one per lane), each in its own worktree. Migrations use unique timestamps. Rebase on
  `main` before merging; the shared files (`nav-sections.ts`, `job-role.ts`) are pre-registered by loop 11.

## Order
| Step | Loop | Scope | Drift doc | Needs |
|---|---|---|---|---|
| 1 (done) | 11 Office foundation | Shell, roles, teams, access matrix, View as, Google sign-in, storage, print layout, i18n, public holidays, seed | all | - |
| 2A (built, parity and merge pending) | Sales | Companies view, customer sheet, Sales Calendar (invites, calls, outcomes, weekly outcomes and reports), Projects deltas | shell-sales | 11 |
| 2B | Costing | Whole Costing module + project card link | new-modules | 11 |
| 3A | MOF & money | Variation orders, MOF change history, commission 180-day cut and appeals, performance, reports two-step review + print, site report | money-reports | 2A |
| 3B | People & HR | Tasks, Leave, HR, Tools & Forms, People leftovers (targets, handover, sales teams) | new-modules | 2B |
| 4B | Site & stock | Log work (BM), Site Work tabs, Installation views, installers, DO numbering + lines + print, delivery log, Stock, Samples, Leftover | site-stock | 3B |
| 4A | Claims | Monthly claims, travel expenses, OT folded in, appeals tab, settings, print | money-reports | 3A, 3B |
| 5 | Integration | Role dashboards and banners, nav badges, leave in calendar and site work, WhatsApp reminders, PWA | all | all |
| later | Zoho | Link to Zoho (Vicky: "later") | - | 5 |

Loop numbers are given when each loop is planned (`/plan-loop`), from this table and its drift doc.

## Open for later planning
- WhatsApp sending provider (Meta Cloud API vs a reseller), message templates, cost: decide when planning Integration.
- Zoho scope: decide after Integration.
