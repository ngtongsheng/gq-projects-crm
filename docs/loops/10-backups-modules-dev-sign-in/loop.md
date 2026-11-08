# Loop 10: Encrypted backups, modules, dev sign-in
Orchestrator: sonnet/high
## Goal
Live database backups are no longer readable from the public repo. The app has a top navigation that picks a module,
each with its own sidebar (CRM only for now). On a laptop, Vicky switches job role from a floating panel without a
password. The sign-in page tells people what to do when they forget their password.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Repo stays public until Vercel Pro is bought | Vicky's squash merges carry her as author; forum reports say Vercel Hobby blocks private-repo deploys from non-owners | Private now (blocks her go-lives); second private repo for code (same Vercel block) |
| D2 | Encrypt backups with a passphrase (GPG symmetric, AES256), artifact renamed `prod-backup-encrypted` | Anyone signed in can read artifacts on a public repo; gpg is preinstalled, no new dependency or token | Private backup repo (extra token, pre-migration backup still runs here) |
| D3 | Task 01 ships alone on `fix/encrypt-backups` straight to main, ahead of the rest of the loop | The nightly job keeps publishing plain dumps until this is on main | Waiting for the end-of-loop merge |
| D4 | Delete every artifact named exactly `prod-backup` after a fresh encrypted backup succeeds | Owner approved in planning; the name also catches any nightly dump added before the fix landed | Keeping plain dumps as restore points |
| D5 | Module is a field on each nav section; AppShell picks the active module from the pathname; CRM is the only module | Smallest shape that gives per-module sidebars | Route prefixes (`/crm/...`), file moves, repo or domain rename |
| D6 | People and Sales Performance stay in the CRM sidebar for now | No second module exists to justify a company-wide area | New settings area |
| D7 | Dev role panel: all 7 job roles, every page including sign-in, uses `generateLink` + `verifyOtp` as "Sign in as" does | Reuses a working pattern and the existing test users | Autofilling passwords |
| D8 | The server action itself refuses unless `NODE_ENV` is `development` and the URL is the test copy | Server actions are reachable in production builds, so hiding the panel is not a gate | UI-only gating |
| D9 | Retire the `test-sign-ins` skill; keep `pnpm reset:sign-ins` because it creates the test users | Panel replaces handing out passwords | Keeping both flows |
| D10 | Forgot password is a message pointing to an admin, who uses the existing new-link button | Supabase built-in email reaches project team addresses only, 2 per hour; owner chose no email service | Custom SMTP reset email |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Encrypt backups and ship first | todo | | sonnet/high |
| 02 | Fresh encrypted backup, delete plain ones | todo | 01 | sonnet/high |
| 03 | Top navigation and per-module sidebars | todo | | sonnet/high |
| 04 | Docs describe a multi-module app | todo | 03 | haiku/low |
| 05 | Dev role panel with one-click sign-in | todo | | opus/medium |
| 06 | Retire the test sign-ins step | todo | 05 | haiku/low |
| 07 | Forgot password message | todo | | haiku/low |
## Owner actions
- Before #01: create a long random passphrase in your password manager, then run
  `! gh secret set BACKUP_PASSPHRASE --repo ngtongsheng/gq-projects-crm` and paste it. If it is lost, the backups cannot be opened.
- Any time: tell Vicky live backups were downloadable while the repo was public. Nobody can tell from GitHub whether
  they were downloaded. Decide with her whether staff should change passwords and whether anyone must be notified.
- Later: buy Vercel Pro, then make the repo private (D1).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
