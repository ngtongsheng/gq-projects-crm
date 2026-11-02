# Environments

Status: Supabase, GitHub secrets and Vercel (project, env vars, auth URLs) are set up. The push-to-`main` deploy is checked after the first merge.

Vercel project: `gq-projects-crm` (team `ng-tong-shengs-projects`, Hobby), linked to GitHub `ngtongsheng/gq-projects-crm`, production branch `main`.

| Environment | Where it runs | URL | Database | Env vars come from |
|---|---|---|---|---|
| Local | `pnpm dev` | `http://localhost:3000` | Supabase `gq-crm-dev` | `.env.development` (committed, public values only) |
| Preview | Vercel preview per branch/PR | `https://gq-projects-crm-git-<branch>-ng-tong-shengs-projects.vercel.app` (read from the Vercel bot comment on the PR) | Supabase `gq-crm-dev` | Vercel env, Preview + Development scope |
| Production | Vercel, branch `main` | `https://gq-projects-crm.vercel.app` | Supabase `gq-crm-prod` | Vercel env, Production scope |

| Supabase project | Region | Ref | API URL | Dashboard auth settings |
|---|---|---|---|---|
| `gq-crm-dev` | Singapore (`ap-southeast-1`) | `heobsflkmqwkesfgbehz` | `https://heobsflkmqwkesfgbehz.supabase.co` | Public sign-ups off. Site URL `http://localhost:3000`; redirect allow-list `http://localhost:3000/**` and `https://gq-projects-crm-*-ng-tong-shengs-projects.vercel.app/**` |
| `gq-crm-prod` | Singapore (`ap-southeast-1`) | `jepoalodqfrgeddzpfgz` | `https://jepoalodqfrgeddzpfgz.supabase.co` | Public sign-ups off. Site URL `https://gq-projects-crm.vercel.app` |

## Variables

Supabase now issues a publishable key and a secret key; the legacy `anon` / `service_role` keys still exist but are deprecated, so the current names are used for the public key.

| Name | Local | Preview | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | dev | dev | prod |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | dev | dev | prod |
| `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`; holds the project's secret key; Sensitive in Vercel) | not set | dev | prod |

Vercel stores the dev values for both Preview and Development (the secret key as two Sensitive entries, one per scope). The two public vars are Config type; values are not secret.

## Seeding the first admins

Admins are created once per environment by `scripts/seed-admin.ts`, never by a migration (no personal data in git). New users always start as `staff`; the script promotes them.

1. Put the project's secret key in a throwaway `.env.seed` (gitignored by `.env*`): `SUPABASE_SERVICE_ROLE_KEY=...`. For prod, also set `NEXT_PUBLIC_SUPABASE_URL` there to the prod URL and drop the `.env.development` flag below.
2. Run per person:
   `node --env-file=.env.development --env-file=.env.seed scripts/seed-admin.ts --email someone@example.com --name "Full Name"`
3. It prints a temporary password once. Send it privately; there is no password change screen yet.
4. Delete `.env.seed`.

## Example data on the test copy

`pnpm seed:example` fills the test copy (`gq-crm-dev`) with fictional records for every module and creates one test sign-in per job role (`test-md@example.invalid`, `test-director@`, `test-bd@`, `test-sales@`, `test-accounts@`, `test-site@`, `test-support@`). It refuses to run unless the URL is the test copy, so it cannot touch the live app.

1. Create `.env.seed.dev` (gitignored by `.env*`) with one line: `SUPABASE_SERVICE_ROLE_KEY=<secret key of gq-crm-dev>`. The URL comes from `.env.development`.
2. Run `pnpm seed:example`. It prints row counts and each sign-in's password once; passwords change on every run and are never stored.
3. Safe to re-run: example rows have fixed ids, and a run deletes only those before adding them again. Records the team added by hand stay, but a re-run stops with a message if one points at an example order.
4. Delete `.env.seed.dev` when done.

Installer claims are seeded unverified and unpaid, and site follow-ups open: verifying, paying and closing are stamped with the signed-in person, so try those in the app.

## GitHub secrets (names only)

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`

`SUPABASE_ACCESS_TOKEN` is a full-account Supabase token (`gq-crm-github-ci`) that expires after 90 days. When CI starts failing with an auth error, create a new token at supabase.com/dashboard/account/tokens and run `gh secret set SUPABASE_ACCESS_TOKEN`.

## CI and deploy pipeline

Workflows live in `.github/workflows/`. Node and pnpm versions come from `mise.toml`; the Supabase CLI is the pinned devDependency (`pnpm exec supabase`).

| Workflow | Trigger | Jobs |
|---|---|---|
| `checks.yml` | pull request (also on label add/remove) | `checks` (biome, typecheck, test, build), `migration-guard` (label `owner-approved` sets `OWNER_APPROVED`), `migrate-dev` (needs the guard; pushes to `gq-crm-dev` only when the PR changes `supabase/migrations/`, otherwise does nothing) |
| `migrate-prod.yml` | push to `main` touching `supabase/migrations/**` | `migrate-prod` (`supabase db push` to `gq-crm-prod`, one run at a time, never cancelled) |

Vercel deploys from its own GitHub integration, not from these workflows. Migrations and the Vercel prod build run in parallel on merge (see `docs/debt.md`).

Repo settings already applied: delete branch on merge on, label `owner-approved` created.

## After first merge

The workflows must exist on `main` before PR checks can run, so these are done after the first merge.

1. Branch protection and auto-merge are blocked on the current plan: GitHub returns "Upgrade to GitHub Pro or make this repository public" for a private repo on the Free plan, and `allow_auto_merge` stays `false`. Choose one: upgrade the owner account to GitHub Pro, or move the repo to a plan or org that has it (handover to Vicky's org needs the same). Until then the checks are advisory: only merge after `gh pr checks <n>` is green.
2. Once protection is available, run this (required checks are the job names `checks` and `migration-guard`; admins are not enforced so the owner can still push to `main` directly):

   ```sh
   gh api -X PATCH repos/ngtongsheng/gq-projects-crm -F allow_auto_merge=true
   gh api -X PUT repos/ngtongsheng/gq-projects-crm/branches/main/protection --input - <<'JSON'
   {
     "required_status_checks": {
       "strict": false,
       "checks": [{ "context": "checks" }, { "context": "migration-guard" }]
     },
     "enforce_admins": false,
     "required_pull_request_reviews": null,
     "restrictions": null
   }
   JSON
   ```
3. Verify with a harmless migration PR: all three jobs green, `pnpm exec supabase migration list` shows it on dev; a PR with `drop table` fails `migration-guard` and passes after the `owner-approved` label; merging applies it to prod and Vercel deploys.
4. The first merge carries `20261101120000_profiles.sql`. It was applied to dev by hand with its history row, so `migrate-dev` is a no-op there; `migrate-prod` applies it to prod on that merge.
