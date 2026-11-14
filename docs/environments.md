# Environments

Status: Supabase, GitHub secrets and Vercel (project, env vars, auth URLs) are set up. Merging to `main` deploys; a migration on `main` first dumps prod, then applies.

Vercel project: `gq-projects-crm` (team `ng-tong-shengs-projects`, Hobby), linked to GitHub `ngtongsheng/gq-projects-crm`, production branch `main`.

| Environment | Where it runs | URL | Database | Env vars come from |
|---|---|---|---|---|
| Local | `pnpm dev` | `http://localhost:3000` | Supabase `gq-crm-dev` | `.env.development` (committed, public values only) |
| Preview | Vercel preview per branch/PR | `https://gq-projects-crm-git-<branch>-ng-tong-shengs-projects.vercel.app` (read from the Vercel bot comment on the PR) | Supabase `gq-crm-dev` | Vercel env, Preview + Development scope |
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
| `ALLOWED_EMAIL_DOMAINS` (comma-separated; the Google sign-in callback refuses other domains, and refuses everyone when unset) | `.env.development`: `gqprojects.com.my,example.invalid` | `gqprojects.com.my,example.invalid` | `gqprojects.com.my` |

Vercel stores the dev values for both Preview and Development (the secret key as two Sensitive entries, one per scope). The two public vars are Config type; values are not secret.

## Google sign-in

Status (checked 2026-11-15 on the laptop): an address nobody added is refused, with no session. GCP project, OAuth client, `GOOGLE_OAUTH_*` secrets, Vercel `ALLOWED_EMAIL_DOMAINS` and the `AUTH_*` repo
variables are in place, and the test copy has the Google provider on (set by hand). Still to do: run `auth-config.yml`
once it is on `main` (sets the live app), and publish the consent screen (still in Testing, see below).

People sign in with Google only (loop 11, D2). The OAuth client "GQP Office" (Web application) lives in the GCP project
`gqp-office`, owned for now by the owner's personal Google account (no organisation). Consent screen: External, app
"GQP Office", scopes `openid`, `userinfo.email`, `userinfo.profile`. Its authorised redirect URIs are each Supabase
project's `https://<ref>.supabase.co/auth/v1/callback` (test copy and live app).

The consent screen is still in **Testing**: only Google accounts listed under Audience, Test users can sign in (max
100). Publishing needs the Branding page completed (app home page, privacy policy link, authorised domain); do it
before the team uses the live app.

- Invite-only: Supabase sign-ups stay off, so a Google account nobody added is refused by Supabase itself. Adding a
  person in People creates their user with a confirmed email; their first Google sign-in with the same email links to
  that user (Supabase automatic identity linking).
- `/auth/callback` exchanges the code, then signs out anyone whose email domain is not in `ALLOWED_EMAIL_DOMAINS`, who
  has no profile, or who has left (`profiles.active`).
- Provider, site URL, redirect allow-list and sign-ups-off are pushed per project by `scripts/push-auth-config.ts`
  through `.github/workflows/auth-config.yml` (manual: `gh workflow run auth-config.yml`). It sends only those fields.
  Inputs: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_{DEV,PROD}_PROJECT_REF`, `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`; repo variables `AUTH_{DEV,PROD}_SITE_URL`, `AUTH_{DEV,PROD}_REDIRECT_URLS`.
- The laptop role panel (`/dev`) still signs in the `example.invalid` test personas on the test copy without Google.

## Seeding the first admins

Admins are created once per environment by `scripts/seed-admin.ts`, never by a migration (no personal data in git). New users always start as `staff`; the script promotes them.

1. Put the project's secret key in a throwaway `.env.seed` (gitignored by `.env*`): `SUPABASE_SERVICE_ROLE_KEY=...`. For prod, also set `NEXT_PUBLIC_SUPABASE_URL` there to the prod URL and drop the `.env.development` flag below.
2. Run per person:
   `node --env-file=.env.development --env-file=.env.seed scripts/seed-admin.ts --email someone@example.com --name "Full Name"`
3. It prints a temporary password once. Send it privately; there is no password change screen yet.
4. Delete `.env.seed`.

## Example data on the test copy

`pnpm seed:example` fills the test copy (`gq-crm-dev`) with fictional records for every module and creates one test sign-in per person in the demo's People list (17 people, e.g. `test-vicky@example.invalid`, `test-eddie@`, `test-waimun@`), with their job role, title, flags and team (`reports_to`); Lisa and Marketing Exec are seeded as left. The old per-role test sign-ins (`test-md@` ... `test-support@`) are marked inactive on the next run. The laptop's "Sign in as" panel lists the active ones as "Name — title". It refuses to run unless the URL is the test copy, so it cannot touch the live app.

1. Create `.env.seed.dev` (gitignored by `.env*`) with one line: `SUPABASE_SERVICE_ROLE_KEY=<secret key of gq-crm-dev>`. The URL comes from `.env.development`.
2. Run `pnpm seed:example`. It prints row counts and each sign-in's password once; passwords change on every run and are never stored.
3. Safe to re-run: example rows have fixed ids, and a run deletes only those before adding them again. Records the team added by hand stay, but a re-run stops with a message if one points at an example order.
4. Delete `.env.seed.dev` when done.

Installer claims are seeded unverified and unpaid, and site follow-ups open: verifying, paying and closing are stamped with the signed-in person, so try those in the app.

## Trying database changes from a laptop

Vicky's agent can try database changes and admin-only screens on the test copy without help. The owner sends her two
values privately (WhatsApp, never git or an issue): the `gq-crm-dev` secret key and the `gq-crm-dev` database password.
The prod values never leave the owner's machines.

1. She pastes both into the `connect-test-copy` skill. `pnpm connect:test-copy` reads them from stdin, checks the key
   against the test copy and writes `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DEV_DB_URL` to `.env.local` (gitignored,
   mode 600). It refuses any project except the test copy.
2. `pnpm db:test-copy` applies pending migrations to the test copy only. It exits before connecting if the connection
   string is not the test copy's.
3. `pnpm reset:sign-ins` creates the test users the floating panel needs. She switches job roles from the panel at the
   bottom of the page. On the live app she uses "View as" (People) instead.
4. A new worktree has no `.env.local`; `pnpm copy-env` copies it from the main folder. Works on Windows and Mac.

Owner check after sending the values, on your Mac in the main checkout: `pnpm connect:test-copy`, `pnpm db:test-copy`
(expect "up to date"), `pnpm reset:sign-ins` (expect 7 sign-ins).

## Agent hooks and permissions

`.claude/settings.json` runs `scripts/agent/session-sync.mjs` at session start and, at most every 15 minutes, on a
prompt. It pulls `main` when the folder is clean (else fetches) and injects open issues that carry instructions for her
agent: label `for:vicky-claude` authored by `ngtongsheng`, or `from:crm` issues whose newest comment is by
`ngtongsheng`. Only that account counts as an instruction. To steer her agent remotely, open an issue with
`for:vicky-claude`; the agent does the work in its own worktree, ships it, comments the result and closes the issue.
After two failed attempts it assigns the issue back to you.

Her agent may run `git push -u origin HEAD`, `git push origin HEAD:*` and `gh pr create/merge/edit`. Pushes to `main`,
force pushes and `--admin` merges stay denied. If a push is still refused, `deploy` leaves a `vicky-approved-<branch>`
marker in the git folder and calls `get-help`; add an allow rule on `main`, and her next session pulls it and
`ship-queue` finishes the push.

`get-help` (from gq-setup) attaches a diagnosis and a condensed, secret-redacted transcript of the current session in
collapsed blocks, so you can act without asking her.

## GitHub secrets (names only)

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_DB_PASSWORD`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`, `SUPABASE_DEV_PUBLISHABLE_KEY`, `SUPABASE_PROD_PUBLISHABLE_KEY` (the public keys, only used by `health.yml`), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (used by `auth-config.yml`)

Repo variables (not secret): `AUTH_DEV_SITE_URL`, `AUTH_DEV_REDIRECT_URLS`, `AUTH_PROD_SITE_URL`, `AUTH_PROD_REDIRECT_URLS`.

`SUPABASE_ACCESS_TOKEN` is a full-account Supabase token (`gq-crm-github-ci`) that expires after 90 days. `health.yml` checks it twice a week and opens an `Urgent:` issue before it bites. To renew, create a new token at supabase.com/dashboard/account/tokens and run `gh secret set SUPABASE_ACCESS_TOKEN`.

`SUPABASE_DEV_DB_PASSWORD` is also what the owner sends Vicky (below). If it is lost, reset it in the `gq-crm-dev` dashboard (Database settings), run `gh secret set SUPABASE_DEV_DB_PASSWORD`, and send her the new one.

## CI and deploy pipeline

Workflows live in `.github/workflows/`. Node and pnpm versions come from `mise.toml`; the Supabase CLI is the pinned devDependency (`pnpm exec supabase`).

| Workflow | Trigger | Jobs |
|---|---|---|
| `checks.yml` | pull request (also on label add/remove) | `checks` (biome, typecheck, test, build), `migration-guard` (label `data-loss-approved` sets `DATA_LOSS_APPROVED`), `migrate-dev` (needs the guard; pushes to `gq-crm-dev` only when the PR changes `supabase/migrations/`, otherwise does nothing) |
| `migrate-prod.yml` | push to `main` touching `supabase/migrations/**` | `backup` (runs `backup.yml`; a failed dump stops here), then `migrate-prod` (`supabase db push` to `gq-crm-prod`, one run at a time, never cancelled) |
| `backup.yml` | nightly 18:00 UTC, manual, and called by `migrate-prod` | `backup-prod`: `supabase db dump` of schema and data to the Actions artifact `prod-backup-encrypted` (GPG, AES256, passphrase in the `BACKUP_PASSPHRASE` secret), kept 30 days. The repo is public, so the dump is only ever uploaded encrypted |
| `health.yml` | Mondays and Thursdays 01:00 UTC, manual (`simulate_failure` input tests the report) | sends each project a request through its REST API (Supabase counts API and database activity, see the pausing doc at supabase.com/docs/guides/platform/pausing, so Free projects are not paused after 7 low-activity days), runs a database query as a bonus, and checks `SUPABASE_ACCESS_TOKEN`; any failure opens or updates an `Urgent: CRM health check failed` issue assigned to the owner, label `from:crm` |

Vercel deploys from its own GitHub integration, not from these workflows. Migrations and the Vercel prod build run in parallel on merge (see `docs/debt.md`).

Repo settings already applied: delete branch on merge on, labels `data-loss-approved` and `from:crm` created (Vicky's agent adds `data-loss-approved` after she agrees to a loss).

## After first merge

The workflows must exist on `main` before PR checks can run, so these are done after the first merge.

1. Branch protection and auto-merge are blocked on the current plan: GitHub returns "Upgrade to GitHub Pro or make this repository public" for a private repo on the Free plan, and `allow_auto_merge` stays `false`. Choose one: upgrade the owner account to GitHub Pro, or move the repo to a plan or org that has it (handover to Vicky's org needs the same). Until then the checks are advisory: only merge after `gh pr checks <n>` is green.
2. Once protection is available, run this (required checks are the job names `checks` and `migration-guard`; admins are not enforced so the owner can still push to `main` directly):

   ```sh
   gh api -X PATCH repos/ngtongsheng/gq-projects-crm -F allow_auto_merge=true
   gh api -X PUT repos/ngtongsheng/gq-projects-crm/branches/main/protection --input - <<'JSON'
   {
     "required_status_checks": {
       "strict": false,
       "checks": [{ "context": "checks" }, { "context": "migration-guard" }]
     },
     "enforce_admins": false,
     "required_pull_request_reviews": null,
     "restrictions": null
   }
   JSON
   ```
3. Verify with a harmless migration PR: all three jobs green, `pnpm exec supabase migration list` shows it on dev; a PR with `drop table` fails `migration-guard` and passes after the `data-loss-approved` label; merging applies it to prod and Vercel deploys.
4. The first merge carries `20261101120000_profiles.sql`. It was applied to dev by hand with its history row, so `migrate-dev` is a no-op there; `migrate-prod` applies it to prod on that merge.

## Restoring from a backup

Prod is dumped before every migration reaches it and nightly. To recover: Actions, the run you want, download the
`prod-backup-encrypted` artifact (30 days; it unzips to `prod-backup.tar.gz.gpg`), then:

```sh
gpg --decrypt prod-backup.tar.gz.gpg > prod-backup.tar.gz   # asks for BACKUP_PASSPHRASE
tar -xzf prod-backup.tar.gz                                  # gives backup/schema.sql and backup/data.sql
```

Restore into a fresh Supabase project with `psql`. Do it yourself; Vicky's agent never touches prod data. Keep the
passphrase in the owner's password manager too: if the GitHub secret is lost, the backups cannot be opened.
