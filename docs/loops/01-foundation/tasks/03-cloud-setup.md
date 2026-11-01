---
model: sonnet
effort: high
why: browser-driven dashboard setup across 3 services; errors leak keys or mis-wire environments
depends: [01]
---
# 03 Cloud setup (Supabase, Vercel, secrets)
## Goal
Two Supabase projects, a Vercel project deploying from GitHub with correct env vars per environment, GitHub secrets for CI.
## Context
- Owner authorized Claude in Chrome (profile "Agent") for Vercel + Supabase dashboards; owner is logged in to both.
  Load the `claude-in-chrome` skill first. GitHub: `gh` CLI only, never browser (D10).
- Free tiers (D9). Region: Singapore (`ap-southeast-1`).
- Env mapping (D3): Vercel Preview + Development → dev project; Production → prod project.
  Vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the current publishable-key name per Supabase docs),
  `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`).
- Never print keys in chat or logs; write them only to their destinations.
## Files to touch
`.env.development` (dev URL + anon key only), `supabase/config.toml` (via `supabase init`, CLI from devDependency), `docs/environments.md`
## Steps
1. Supabase: create `gq-crm-dev` and `gq-crm-prod` in Singapore; strong DB passwords generated locally, stored only as GitHub secrets.
   Auth settings both: disable public sign-ups; site URL = Vercel prod URL (prod) / preview pattern + localhost (dev redirect allow-list).
2. `pnpm add -D supabase`; `supabase init`. Commit `.env.development`.
3. Push the repo (already exists on GitHub). Vercel: import `ngtongsheng/gq-projects-crm`. If Vercel needs the GitHub
   app approved, park `blocked: owner — approve Vercel GitHub app` and continue with other tasks.
4. Set Vercel env vars per mapping. Production branch = `main`.
5. GitHub secrets via `gh secret set`: `SUPABASE_ACCESS_TOKEN` (create a Supabase personal access token in the dashboard),
   `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`.
6. `docs/environments.md`: table of environments, URLs, which DB, which secrets exist (names only).
## Acceptance
- `gh secret list` shows the 5 secrets.
- A push to main deploys to Vercel prod; the deployment URL loads the placeholder page.
- `.env.development` contains no service-role key (`grep -i service .env.development` → nothing).
## Out of scope
Migrations, CI workflows, auth code.
