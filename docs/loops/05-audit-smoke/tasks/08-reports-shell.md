---
model: sonnet
effort: high
why: reports/dashboard logic plus shared components; defined checklist
depends: [02, 03]
---
# 08 Audit + fix: reports, dashboard, shared components, auth, guide, dev
## Goal
Every file in scope meets `docs/loops/05-audit-smoke/assets/audit-checklist.md`; all findings are fixed or routed.
## Context
- Apply the whole checklist; it says how to fix and when to route a finding to #09 or D4.
- Decisions already taken (not findings): loop 03 D1-D12 and `decision` lines in `docs/loops/03-crm-features/loop.md` Log; existing rows in `docs/debt.md`.
- Earlier findings: `docs/loops/05-audit-smoke/findings.md` (don't duplicate).
- Known: report figures computed in the app (debt.md).
## Files to touch
- src/app/(app)/reports/**, dashboard/**, guide/**, not-allowed/**, layout.tsx, page.tsx
- src/app/(auth)/**, src/app/dev/**, src/app/layout.tsx, src/components/app/**
- src/components/ui/** only for theme-token misuse (shadcn files otherwise stay as generated)
- docs/loops/05-audit-smoke/findings.md, docs/debt.md (only for shortcuts that can't be fixed in this loop)
## Steps
1. List the files in scope (`find`), read each fully, note violations against the checklist.
2. Run `pnpm check` and `pnpm typecheck` first to catch anything the tools already see.
3. Fix module-local findings, one commit per finding group. Add regression tests for logic bugs.
4. Add every finding to `findings.md` with its status.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test` pass.
- `grep -rnE '\bany\b|@ts-ignore|@ts-expect-error|biome-ignore|console\.(log|debug)' <scope> --include='*.ts' --include='*.tsx'`: no hits except justified ones noted in findings.
- Every finding row for task 08 has a status; none left `open`.
## Out of scope
Files outside the scope (route to #09). New dependencies. Browser testing (#10, #11).
