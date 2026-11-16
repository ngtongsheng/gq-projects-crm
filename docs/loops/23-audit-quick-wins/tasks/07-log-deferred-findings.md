---
tier: economy
why: writing given content into two docs
depends: []
---
# 07 Log deferred findings, add verification notes
## Goal
Every audit finding not fixed in this loop is in `docs/debt.md`, and the audit file records what was verified.
## Context
Match the entry format already in `docs/debt.md` (`## Title`, then What / Why / When to fix lines). Loop 23 decisions D1-D3
are in `loop.md`. Group related findings; do not write one entry per row.
## Files to touch
- `docs/debt.md`
- `docs/audits/2026-11-16-code-audit.md` (append a section only)
## Steps
1. Add entries, with this content:
   - **Dashboard fan-out (P3, P5):** per-salesperson `loadSalesStats` ~24 queries per MD view; company detail loads a
     contact's full history and slices to 10 in JS. When: team grows or dashboard feels slow.
   - **Unpaginated lists (P6) and missing indexes (P8):** MOF register, Tasks, Collection orders load every row;
     `mof_variation_orders(confirmed_on)` has no index. When: a list takes over ~1 s or at ~2,000 rows.
   - **Yearly target refresh on read (P7):** `refresh_yearly_targets()` runs on the sales dashboard, `/people` and
     `/performance`. When: contention on 1 January, or move to a scheduled job.
   - **Repeated patterns (R1, R3, Q2):** ~99 files re-declare the dialog `useState`/`useTransition` block (promote
     `FormDialog`/`useSubmit` from `installer-forms.tsx`); data layer has no shared helpers; Supabase test mock
     copied across ~53 test files. When: the next change touching many dialogs or tests.
   - **Commission rules twice (R2):** TS `calculateCommission` and SQL `commission_payable_now`/`commission_basis`
     must be kept in step by hand. When: the next commission rule change; pick one authority.
   - **Small consistency items (R4, R5, C1, C2, Q5, Q6):** 9 raw money formats, 2 components importing route code,
     500-line files (`mof-form.tsx`, `pickup-form-dialog.tsx`, `job-form.tsx`, `quote-view.ts`, `report-data.ts`), 47
     `jobRole ===` checks outside `lib/auth`, `noUncheckedIndexedAccess` off and `src/components/ui` excluded from
     Biome, one backfill migration without a rollback note.
   - **Raw English in UI (Q1):** component files render English without `t()`; count not reproduced in verification, so
     start with `grep` before sweeping.
   - **Monthly "late" is judged by today's due time (B2):** changing `app_settings.dueTime` flips past reports' late flag;
     weekly reports store `late` at submit, monthly do not. Business-rule question for Vicky. When: she changes the
     due time or asks for a stable late record (store due time at submit).
   - **Minor (B4, B5):** `ActivityForm` clock-dependent initial state (unverified, safe while client-mounted); a new
     read-only RPC must be added to `READ_ONLY_FUNCTIONS` in `src/lib/supabase/view-only-fetch.ts` or view-as shows
     "View only – not saved." When: when adding such an RPC.
2. Append `## Verification (2026-11-16)` to the audit: findings confirmed, and the corrections from loop D2 (Q3 only
   `effectiveSalesTarget`; `cn` wrapper claim wrong; P7 scope narrower; Q1 count not reproduced); say which findings
   loop 23 fixed (P1, P2, P4, B1, B3, Q3, Q4, R6) and that the rest are in `docs/debt.md`.
## Acceptance
- `pnpm check` passes.
- `grep -c "^## " docs/debt.md` increased by the number of entries added.
## Out of scope
Fixing any of the logged items.
