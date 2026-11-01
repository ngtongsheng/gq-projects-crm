---
model: sonnet
effort: high
why: deploy pipeline ordering and secrets; mistakes hit prod
depends: [03, 07]
---
# 08 CI workflows
## Goal
PR checks + dev migrations on PR; prod migrations on merge to main; auto-merge possible once checks pass.
## Context
- D2, D4, D5. Secrets from #03. Supabase CLI is a devDependency; read its current `db push` / `link` docs.
- Vercel deploys via its GitHub integration (not from Actions). Migrations are additive by default (guard), so running
  prod migrations in parallel with the Vercel prod build is acceptable; note this in `docs/debt.md` if ordering matters later.
## Files to touch
`.github/workflows/checks.yml`, `.github/workflows/migrate-prod.yml`, `docs/debt.md`, `docs/environments.md`
## Steps
1. `checks.yml` (pull_request): install via mise or setup-node+pnpm, `pnpm check`, `typecheck`, `test`, `build`;
   job `migration-guard` (sets `OWNER_APPROVED` from label `owner-approved`, re-runs on `labeled`);
   job `migrate-dev` (needs guard): `supabase db push` to dev when migrations changed.
2. `migrate-prod.yml` (push to main, paths `supabase/migrations/**`): `supabase db push` to prod; concurrency group, no cancel.
3. Repo settings via `gh`: enable auto-merge, delete branch on merge, branch protection on main requiring `checks` +
   `migration-guard` (use `gh api`). Create label `owner-approved`.
4. Append debt entries: parallel migrate/deploy ordering; Vercel Hobby commercial-use (D9); Supabase free no backups.
## Acceptance
- A test PR with a harmless migration: all checks green, migration applied to dev (`supabase migration list` for dev shows it).
- A test PR with `drop table` fails `migration-guard`; adding `owner-approved` label makes it pass. Close it without merging and delete its branch.
- Merging the harmless PR applies it to prod and Vercel deploys prod.
## Out of scope
Agent skills that drive this (#10).
