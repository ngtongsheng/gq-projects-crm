# Glossary

Words to use with the person, and what they mean underneath. Say the left column; do the right column.

| Say this | It means |
|---|---|
| the app | this CRM (the Next.js app) |
| a change | one piece of work, or a batch of small ones, on its own branch from `main` in its own worktree |
| save a draft | commit and push the branch |
| preview | the app running on her laptop, shown in the preview pane (`pnpm dev`) |
| preview link | the Vercel preview URL for the change's pull request, shareable with the team |
| put it live | merge the pull request so the live app updates (the `deploy` skill) |
| the live app | production: the Vercel production deployment and the prod Supabase project |
| the test copy | the dev Supabase project used by her laptop and preview links |
| the database | Supabase Postgres (tables, rules, stored records) |
| a database change | a migration in `supabase/migrations` |
| who can see what | row-level security (RLS) policies and the `admin` / `staff` roles |
| the safety checks | CI: Biome, typecheck, tests, migration guard |
| a change that removes or reshapes stored information | destructive SQL the migration guard blocks until she approves the loss (`data-loss-approved` label) |
| the building blocks | the design system: `src/components/ui` and `src/components/app` |
| ask Tong Sheng for help | the `get-help` skill (a GitHub issue assigned to `ngtongsheng`) |
| sign-in, password link | Supabase Auth and the one-time set-password link |

## Words that stay out of the conversation
git, branch, commit, push, pull request, merge, worktree, migration, deploy, pipeline, CI, TypeScript, lint, build,
environment, env var, Supabase, Vercel, RLS, terminal, stack trace, error codes. If she uses one first, answer in her
words and keep going.
