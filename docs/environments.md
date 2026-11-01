# Environments

Status: Supabase and GitHub secrets done. Vercel project not created yet (blocked: Vercel asks for an email code to confirm the first deploy). Items marked TBD are filled in once the Vercel project exists.

| Environment | Where it runs | Database | Env vars come from |
|---|---|---|---|
| Local | `pnpm dev` | Supabase `gq-crm-dev` | `.env.development` (committed, public values only) |
| Preview | Vercel preview per branch/PR | Supabase `gq-crm-dev` | Vercel env, Preview + Development scope |
| Production | Vercel, branch `main` | Supabase `gq-crm-prod` | Vercel env, Production scope |

| Supabase project | Region | Ref | API URL | Dashboard auth settings |
|---|---|---|---|---|
| `gq-crm-dev` | Singapore (`ap-southeast-1`) | `heobsflkmqwkesfgbehz` | `https://heobsflkmqwkesfgbehz.supabase.co` | Public sign-ups off (done). TBD: redirect allow-list = `http://localhost:3000/**` + Vercel preview pattern |
| `gq-crm-prod` | Singapore (`ap-southeast-1`) | `jepoalodqfrgeddzpfgz` | `https://jepoalodqfrgeddzpfgz.supabase.co` | Public sign-ups off (done). TBD: site URL = Vercel prod URL |

## Variables

Supabase now issues a publishable key and a secret key; the legacy `anon` / `service_role` keys still exist but are deprecated, so the current names are used for the public key.

| Name | Local | Preview | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | dev | dev | prod |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | dev | dev | prod |
| `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`; holds the project's secret key) | not set | dev | prod |

## GitHub secrets (names only)

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`

`SUPABASE_ACCESS_TOKEN` is a full-account Supabase token (`gq-crm-github-ci`) that expires after 90 days. When CI starts failing with an auth error, create a new token at supabase.com/dashboard/account/tokens and run `gh secret set SUPABASE_ACCESS_TOKEN`.
