# Drift: Costing, Tasks, Leave, HR, Tools & Forms, People

Spec: `docs/mockup/gqp-office-demo.html`. Analysed 2026-11-14. None of these exist except People (in part).
The demo keys records by name and stores JSON blobs; the app models them as tables keyed by profile id with RLS.

## People (`vPeople` ~4995; ours `/people`): S-M after loop 11
- Exists: add person, job role, role, commission mode, yearly target, arranges stock, invite share, Sign in as.
- Loop 11 adds: join date, left / active, last day + reason, reports-to, sells, margin, WhatsApp, language, access
  matrix editor, read-only View as.
- Left for later: per-year targets and visit targets, resignation handover (customers and projects to another person,
  handover list), "Sales teams" panel.

## Costing (GQC app ~436-1450, mounted by `vCost` ~1920): L, independent
- Screens: Register (search, status filter, sort); New quote; Quote record (revision tabs Original/R1/R2, option cards
  A/B/C with sell, cost, margin, item tables by category, action bar); Approvals "Below min margin" (pending + recent);
  FOB Enquiry (global table for purchasing + per-quote panel); client quote preview (single or option compare; print,
  copy as TSV). `vTeam` (grades J1-M2, limits) is unreachable in the demo: do not build.
- Entities: quote (quote no, project, customer, salesperson, project link, updated); revision (rev, status draft /
  submitted / approved / returned, fx USD + RMB, SST 10%, target margin, chosen option, history: action, who, when, note);
  option (key, label); item (category, type, area, product, supplier, unit, qty, rate, desc, remark, type cost fields);
  enquiry (quote no, product, qty, unit, supplier, currency, FOB, fx, shipping, notes, replied by/at, status).
- Maths: landed per m² = FOB × fx × (1 + SST) + shipping; sqft ÷ 10.764. Unit cost by type: local = material ×
  (1 + wastage) + underlay + accessories + install; import = landed × (1 + wastage) + underlay + install; rug = L × W ×
  landed or per-piece + edging + install; labour = install + underlay + accessories; lump = cost; discount = negative
  sell, zero cost. Supply-only drops install. Option totals cost, sell, profit, margin; colours <20% red, 20-30% amber,
  ≥30% green. Quote amount = highest option sell.
- Rules: salespeople own quotes; md, director and see-all roles (purchasing, accounts) see all. Min margin setting
  (default 30%). Lowest option ≥ min: owner confirms, no approval. Below: reason required, submit; md or director approve
  or return with a note. Then "OK to quote", owner picks the option or opens a revision. Edit in draft, returned,
  submitted. Cost and margin hidden without the margin flag (show "Low / High margin").
- UI language: Chinese with an English toggle in the demo (default English): use the loop 11 i18n with 中文 strings.
- Links: `costLines(p)` on the project card (quotes by project, status, option totals, "Use RM X as project value" when
  approved and no MOF, "Open costing"). Gated by the cost page access. Nav badge for md/director.

## Tasks (`vTasks` ~3104): M, independent
- Tabs: My tasks, Assigned by me, All tasks, Workload (md/director). Tiles overdue, due this week, revision. Task sheet
  with log, file upload (versions), review panel.
- Fields: title, category (11), project (optional), assignee + co-assignees, assigner, priority Low-Urgent, due, status,
  files, revision count, log. Flow: Not Started → In Progress → Pending Review → Revision Required → Completed. Only the
  assigner or md approves; revision needs a comment. Assigners: md, director, bd, support, marketing.
- Reminders: before, after, escalate (`tkCfg`).

## Leave (`vLeave` ~3206): M
- My leave (balance tiles), Waiting for approval, Team leave (md, director, accounts), Who is away (month), Public
  holidays (admin edits; table from loop 11).
- Types: Annual, MC, Emergency, Hospitalisation, Replacement, Compassionate, Maternity/paternity, Unpaid. Only AL and EL
  deduct annual leave. 14 AL + 14 MC a year, prorated by join month (down to half day), carry forward, per-person
  overrides by year. Working days Mon-Fri (Mon-Sat for site supervisors) minus public holidays; half days 0.5.
- Approvers: sales → team lead then md; bd and site → Eddie and md; others → md; accounts also sees MC. Never your own.
  MC and hospitalisation need a slip upload + "original given to HR".
- Feeds the Sales Calendar on-leave strip and Site Work availability (integration loop).

## HR (`vHR` ~4437): M, md + accounts only
- Policies & schemes: documents (category, version, effective date, Current / Older, PDF or link, "Replaces"), scheme
  summary (bonus bands, commission rates, terms), extra rules log, settings from other modules.
- Staff packages: dated history per person (basic, allowances, claim cap), standard packages for sales and site,
  outstation rules (meal and hotel by level).
- Sales grades & bonus: J1-M2 basic and annual target; bonus <100% none, 100-124% one month basic, ≥125% three months,
  on full-year sales; "appendix signed".
- Feeds Claims (caps), OT rate (basic), targets (People).

## Tools & Forms (`vTools` ~4105): S
- Wallpaper calculator (European 0.53 × 10.06 m, Korean 1.06 × 15.5 m, Fabric Back 1.37 m by running metre; panels =
  ceil(width / roll width) × (height + allowance), then rolls). Vinyl sheet calculator (L × W + skirting, roll width and
  length, layouts A/B by offcut).
- A4 forms, blank or pre-filled from an awarded MOF: site measurement summary, work commencement acknowledgement,
  project handover (HO-01). Best Link sample pickup form link; admin-added Drive links.
