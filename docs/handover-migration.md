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
