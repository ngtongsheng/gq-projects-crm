# Environments

Status: draft. Supabase projects, Vercel project and secrets are not created yet (task 03 blocked on secret writes). URLs and refs marked TBD are filled in when they exist.

| Environment | Where it runs | Database | Env vars come from |
|---|---|---|---|
| Local | `pnpm dev` | Supabase `gq-crm-dev` | `.env.development` (committed, public values only) |
| Preview | Vercel preview per branch/PR | Supabase `gq-crm-dev` | Vercel env, Preview scope |
| Production | Vercel, branch `main` | Supabase `gq-crm-prod` | Vercel env, Production scope |

| Supabase project | Region | Ref | Dashboard auth settings |
|---|---|---|---|
| `gq-crm-dev` | Singapore (`ap-southeast-1`) | TBD | Public sign-ups off; redirect allow-list: Vercel preview pattern + `http://localhost:3000` |
| `gq-crm-prod` | Singapore (`ap-southeast-1`) | TBD | Public sign-ups off; site URL = Vercel prod URL (TBD) |

## Variables

| Name | Local | Preview | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | dev | dev | prod |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or current publishable-key name) | dev | dev | prod |
| `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`) | not set | dev | prod |

## GitHub secrets (names only)

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`
