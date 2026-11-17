---
tier: frontier
why: seven related tables with rename cascades, balances and per-role RLS; sets the shape every marketing task uses
depends: [01]
---
# 09 Marketing expense schema and RLS
## Goal
Tables for the Marketing expense page, seeded categories, rights per role.
## Context
Read `00-shared-context.md`. Decision D5. Spec `demo-changes.md` §2 (all subsections). The demo links by names
(vendor, event, category); use ids with foreign keys so renames cascade for free.
## Files to touch
New migration; `supabase/tests/marketing.test.ts`.
## Steps
1. `marketing_categories` (name unique case-insensitive, sort order; seed the 11 of §2.3; delete blocked while used).
2. `marketing_vendors` (kind company|part_timer, name unique ci, supplies type, contact person, skills[], rate text,
   portfolio url, phone, email, notes; part-timer needs phone or email).
3. `marketing_events` (name unique, start, end, venue, budget, notes) and `marketing_event_costs` (event, cost group,
   description, supplier/ref, foreign amount text, rate, unit default 'ls', qty default 1, total generated, remarks).
4. `marketing_expenses` (date, category, description, vendor, invoice ref, currency enum per §2.1, amount, amount_rm,
   event nullable, payment method enum, remarks, created/updated by).
5. `marketing_prepaid_entries` (date, vendor, kind top_up|deduction, description or client-project, foreign currency
   + amount, amount_rm > 0, mof ref text, marketing_foc bool for deductions, remarks) and a low-balance alert per
   vendor (column on vendors). Balance as a view or query, not stored.
6. `marketing_giveaways` (date, supplier, invoice no, item, given_to, qty, unit cost, total generated).
7. RLS: read md, accounts, ssup, support, marketing (match page access); write same minus accounts.
## Acceptance
- PGlite tests: role read/write matrix; category in use cannot be deleted; vendor rename shows on expenses;
  part-timer without contact refused.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
UI, Excel.
