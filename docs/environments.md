# Environments

Status: Supabase, GitHub secrets and Vercel (project, env vars, auth URLs) are set up. The push-to-`main` deploy is checked after the first merge.

Vercel project: `gq-projects-crm` (team `ng-tong-shengs-projects`, Hobby), linked to GitHub `ngtongsheng/gq-projects-crm`, production branch `main`.

| Environment | Where it runs | URL | Database | Env vars come from |
|---|---|---|---|---|
| Local | `pnpm dev` | `http://localhost:3000` | Supabase `gq-crm-dev` | `.env.development` (committed, public values only) |
| Preview | Vercel preview per branch/PR | `https://gq-projects-crm-<hash>-ng-tong-shengs-projects.vercel.app` | Supabase `gq-crm-dev` | Vercel env, Preview + Development scope |
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

## GitHub secrets (names only)

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`

`SUPABASE_ACCESS_TOKEN` is a full-account Supabase token (`gq-crm-github-ci`) that expires after 90 days. When CI starts failing with an auth error, create a new token at supabase.com/dashboard/account/tokens and run `gh secret set SUPABASE_ACCESS_TOKEN`.
