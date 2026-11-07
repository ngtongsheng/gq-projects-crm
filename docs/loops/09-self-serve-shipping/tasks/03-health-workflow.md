---
model: sonnet
effort: high
why: New scheduled workflow with failure reporting via gh; small but must be correct to be trusted
depends: []
---
# 03 Weekly health workflow
## Goal
`.github/workflows/health.yml` runs weekly and on demand: keeps dev and prod awake, verifies the CI Supabase token,
and opens one `Urgent:` issue assigned to `ngtongsheng` on any failure (D12).
## Context
Supabase Free pauses a project after 7 idle days; `SUPABASE_ACCESS_TOKEN` (`gq-crm-github-ci`) expires 90 days after
creation (around 2027-02). Secrets listed in `docs/environments.md`. Public URLs/publishable keys in
`.env.development` (dev); prod publishable key is public too but not in git: use the management API instead.
## Files to touch
New `.github/workflows/health.yml`.
## Steps
1. `schedule` Monday 01:00 UTC + `workflow_dispatch`, `permissions: issues: write`.
2. Token check: `pnpm exec supabase projects list` with the token; non-zero = failure "CI Supabase token expired".
3. Keep-awake: run a trivial query on dev and prod (`supabase db` via linked project, or psql with DB password secrets).
4. On failure step: `gh issue list --search "Urgent: CRM health" --state open`; comment if found, else
   `gh issue create --assignee ngtongsheng --label from:crm --title "Urgent: CRM health check failed" --body` with the
   failing step and fix (token: `gh secret set SUPABASE_ACCESS_TOKEN`).
## Acceptance
- `gh workflow run health.yml` on the loop branch (or after merge) succeeds.
- Temporarily force failure (dispatch input `simulate_failure: true`) opens the issue; close it after.
## Out of scope
Uptime monitoring of Vercel.
