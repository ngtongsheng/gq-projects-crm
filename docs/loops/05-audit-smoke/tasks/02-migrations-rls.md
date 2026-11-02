---
model: opus
effort: medium
why: security-critical: RLS, security definer functions, column privacy across 23 migrations
depends: [01]
---
# 02 Audit + fix: migrations and RLS
## Goal
Every file in scope meets `docs/loops/05-audit-smoke/assets/audit-checklist.md`; all findings are fixed or routed.
## Context
- Apply the whole checklist; it says how to fix and when to route a finding to #09 or D4.
- Decisions already taken (not findings): loop 03 D1-D12 and `decision` lines in `docs/loops/03-crm-features/loop.md` Log; existing rows in `docs/debt.md`.
- Earlier findings: `docs/loops/05-audit-smoke/findings.md` (don't duplicate).
- Every fix is a new migration `YYYYMMDDHHMMSS_<slug>.sql`, later than all existing ones, additive unless D4.
- Check per table: RLS on, revoke/grant, policies per job role vs. `docs/loops/03-crm-features/assets/prototype-spec.md` "Job roles"; `security definer` functions (`search_path`, caller check); `update_mof_total` reason rule; mof cost managers-only; import functions run with invoker rights.
- Run `pnpm guard:migrations` after adding a migration.
## Files to touch
- supabase/migrations/* (fixes only as NEW migration files; never edit applied ones)
- docs/loops/05-audit-smoke/findings.md, docs/debt.md (only for shortcuts that can't be fixed in this loop)
## Steps
1. List the files in scope (`find`), read each fully, note violations against the checklist.
2. Run `pnpm check` and `pnpm typecheck` first to catch anything the tools already see.
3. Fix module-local findings, one commit per finding group. Add regression tests for logic bugs.
4. Add every finding to `findings.md` with its status.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass.
- `grep -rnE '\bany\b|@ts-ignore|@ts-expect-error|biome-ignore|console\.(log|debug)' <scope> --include='*.ts' --include='*.tsx'`: no hits except justified ones noted in findings.
- Every finding row for task 02 has a status; none left `open`.
## Out of scope
Files outside the scope (route to #09). New dependencies. Browser testing (#10, #11).
