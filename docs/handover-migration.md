# Handover: moving to Vicky's accounts

Every item bound to an account, with the steps to move it. Other sections are added as they are found.

## Supabase keep-alive (`health.yml`)

Supabase Free may pause a project after 7 days of low activity (https://supabase.com/docs/guides/platform/pausing).
`.github/workflows/health.yml` sends each project one request through its REST API twice a week.

Needs per project (nothing is written in code):

| Project | GitHub secrets |
|---|---|
| Test copy | `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_PUBLISHABLE_KEY` |
| Live app database | `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_PUBLISHABLE_KEY` |

Also `SUPABASE_ACCESS_TOKEN` for the token check and the bonus database query.

Move steps: in the new Supabase organization, open each project's Settings, API Keys, copy the publishable key and the
project ref (the part of the URL before `.supabase.co`), then run `gh secret set <NAME>` for the four secrets above and
create a new access token for `SUPABASE_ACCESS_TOKEN`. Run `gh workflow run health.yml` to confirm it passes. Supabase
Pro never pauses, so the workflow can be deleted after an upgrade.

## Accounts and settings

One row per item bound to an account. The rule (loop 11, D12): no project ref, URL or key in code; settings are env,
config or migrations applied by script or CI. Later tasks add rows.

| Item | What moves | Steps |
|---|---|---|
| Vercel project | The project, its domain and env vars | New Vercel team: import the GitHub repo, copy the env vars below, add the domain, update the Supabase auth redirect URLs (Auth, URL configuration) to the new domain. |
| Vercel env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the server-only secret key, `ALLOWED_EMAIL_DOMAINS` (prod `gqprojects.com.my`) | `vercel env add` per environment (Production, Preview) from the new Supabase project's API Keys page. Never commit values. |
| Supabase test copy (dev) | The project: schema, auth config, storage buckets | Create a project in the new org, then apply `supabase/migrations` with the CI script (`supabase link` + `supabase db push`). Buckets and auth providers are created by migrations or script, not by hand. Update `SUPABASE_DEV_*` secrets. |
| Supabase live database (prod) | Live data | Create a project in the new org; for the data use a backup and restore (Dashboard, Database, Backups) or `pg_dump` into the new project, then apply migrations. Update `SUPABASE_PROD_*` secrets and the Vercel env vars, then re-check the Auth redirect URLs. Do this in a quiet hour. |
| GitHub secrets | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_{DEV,PROD}_PROJECT_REF`, `SUPABASE_{DEV,PROD}_PUBLISHABLE_KEY`, database passwords used by CI | `gh secret set <NAME>` for each in the (transferred or new) repo. Create a fresh Supabase access token in the new org. |
| GCP OAuth client (Google sign-in) | GCP project `gqp-office`: the OAuth client and External consent screen "GQP Office" | Move the project into Vicky's Google Workspace org (IAM and Admin, Migrate project). Add each new Supabase project's `https://<ref>.supabase.co/auth/v1/callback` as an authorised redirect URI. If the client is recreated, `gh secret set GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`. Then run the auth config row below. |
| Supabase auth config (Google provider, site URL, redirect allow-list, sign-ups off) | Settings only; nothing in code | Update repo variables `AUTH_{DEV,PROD}_SITE_URL` and `AUTH_{DEV,PROD}_REDIRECT_URLS` (`gh variable set`) to the new domains, update `SUPABASE_{DEV,PROD}_PROJECT_REF`, then `gh workflow run auth-config.yml`. It runs `scripts/push-auth-config.ts` for both projects. |
| `ALLOWED_EMAIL_DOMAINS` | Vercel env (Production `gqprojects.com.my`; Preview and Development also `example.invalid`) and `.env.development` | Copy to the new Vercel project. Unset means nobody can sign in with Google. |
| Storage buckets (file uploads) | Private buckets, their policies and files | Buckets and policies come from migrations. Existing files: copy with the Supabase storage API or `supabase storage cp` between projects. |
| Health workflow | `.github/workflows/health.yml` | Moves with the repo; needs the GitHub secrets above. Delete after a Supabase Pro upgrade (Pro never pauses). |
