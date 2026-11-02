# Debt

| What | Why | When to fix |
|---|---|---|
| Vercel Hobby plan for a business app | Hobby is non-commercial only; accepted during evaluation | At handover: Vercel Pro on Vicky's billing |
| Supabase Free (no backups, pauses after 7 idle days) | Evaluation, $0 | At handover: Supabase Pro |
| Invites by copied link, no email | No company domain for an email sender | When a domain exists: custom SMTP (e.g. Resend) |
| Prod migration and Vercel prod build run in parallel on merge | Migrations are additive by default (the guard enforces it), so old code keeps working until the new build lands | If a migration ever needs to land before or after the deploy: make `migrate-prod` gate the deploy or split the change into two PRs |
| Dev database shared by all PRs | One `gq-crm-dev` project; a migration from a PR that is closed unmerged stays applied, and a second open PR then fails `db push` on a mismatched history | When it bites: repair the history with `supabase migration repair`, or add Supabase branching at handover |
| No branch protection or auto-merge on `main` | GitHub Free private repos do not support them (HTTP 403); checks are advisory | At handover: GitHub Pro or org plan, then run the command in `docs/environments.md` "After first merge" |
