---
model: sonnet
effort: high
why: Dashboard work in Chrome plus finding out what Supabase counts as activity; a wrong guess means another pause
depends: []
---
# 01 Restore Supabase + keep-alive that works
## Goal
Both Supabase projects are active, and `.github/workflows/health.yml` keeps them active with requests Supabase counts
as activity.
## Context
- Projects: `gq-crm-dev` and `gq-crm-prod` (refs and URLs in `docs/environments.md`). One was paused on 2026-11-14 even
  though `health.yml` ran `supabase db query --linked "select 1"` on both, successfully, on 2026-11-09.
- Owner consent (D13): use Claude in Chrome (profile "Agent") for the Supabase dashboard. Load the `claude-in-chrome`
  skill first.
## Files to touch
- `.github/workflows/health.yml`
- `docs/environments.md` (Health row), `docs/handover-migration.md` (keep-alive needs per project; create the file if
  task 02 has not yet)
## Steps
1. In Chrome, open the Supabase dashboard, check both projects, click **Restore project** on any paused one, and wait
   until it shows healthy.
2. Find out from Supabase's docs what keeps a Free project active (check the current docs page on project pausing; do
   not rely on memory). Record the answer with its source URL in the workflow comment.
3. Change the keep-alive steps to make requests that count: e.g. a request to each project's REST API
   (`https://<ref>.supabase.co/rest/v1/...`) with the publishable key, plus the existing DB query if it still helps.
   Build URLs from the `SUPABASE_*_PROJECT_REF` secrets; add the publishable keys as secrets or read them from
   `.env.development` (dev) and the Vercel/GitHub config (prod). No ref, URL or key literal in the file (D12).
4. Run it twice a week (Mon and Thu, 01:00 UTC). Keep the failure-to-issue reporting.
5. Trigger it with `gh workflow run health.yml` and watch it with `gh run watch`.
## Acceptance
- Both projects show active in the dashboard.
- `gh run list --workflow health.yml -L 1` shows `success` for a run started by this task.
- `pnpm check` passes.
## Out of scope
Supabase Pro, changing backup.yml.
