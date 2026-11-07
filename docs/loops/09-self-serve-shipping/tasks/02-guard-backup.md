---
model: sonnet
effort: high
why: Touches the safety guard and prod migration path; mistakes risk prod data
depends: []
---
# 02 Guard false positives, prod dump, nightly backup, label rename
## Goal
Guard stops flagging object-only drops (D3); prod is dumped before every migration and nightly (D2, D13); approval
label is `data-loss-approved` (D2).
## Context
PR 23 failed `migration-guard` on `drop policy "mof costs: managers read" on public.mof_costs` (no stored data).
Guard: `scripts/migration-guard.ts` with tests `scripts/migration-guard.test.ts`. Workflows:
`.github/workflows/checks.yml` (label sets `OWNER_APPROVED`), `migrate-prod.yml`. Secrets: `SUPABASE_PROD_PROJECT_REF`,
`SUPABASE_PROD_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`. Repo is private; artifacts are visible only to collaborators.
## Files to touch
`scripts/migration-guard.ts`, `scripts/migration-guard.test.ts`, `.github/workflows/checks.yml`,
`.github/workflows/migrate-prod.yml`, new `.github/workflows/backup.yml`.
## Steps
1. Test first: `drop policy`, `drop function`, `drop trigger`, `drop view`, `drop index` (with/without `if exists`)
   pass; `drop table`, `drop column`, `alter column ... type`, `rename`, `delete from`, `truncate` still block.
2. Implement in the guard.
3. Rename label: workflow env/name to `DATA_LOSS_APPROVED` / `data-loss-approved`; `gh label create
   data-loss-approved --force`, delete `owner-approved` label after.
4. `migrate-prod.yml`: before `db push`, `pnpm exec supabase db dump` (schema and `--data-only`) against prod, upload
   with `actions/upload-artifact` (pinned major), `retention-days: 30`. Fail the job if the dump fails.
5. `backup.yml`: `schedule` daily 18:00 UTC + `workflow_dispatch`, same dump + upload. Never cancelled.
## Acceptance
- `pnpm test scripts/migration-guard.test.ts` passes with new cases.
- `pnpm guard:migrations` on PR 23's migration (`git show origin/feat/mof-summary:supabase/migrations/20261106140000_mof_cost_rule.sql`) reports no block.
- After merge: `gh workflow run backup.yml`, `gh run watch --exit-status`, artifact listed in `gh run view`.
- `grep -rn owner-approved .github scripts` empty.
## Out of scope
CLAUDE.md/deploy wording (task 06). Restore tooling.
