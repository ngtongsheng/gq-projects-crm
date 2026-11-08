---
model: sonnet
effort: high
why: Touches the production backup path; a mistake loses restore points or keeps leaking data
depends: []
---
# 01 Encrypt backups and ship first
## Goal
Every new live database backup is uploaded only in encrypted form, and this is on `main` before the rest of the loop.
## Context
The repo is public, so plain `prod-backup` artifacts are readable by any signed-in GitHub user. See D2 and D3 in `loop.md`.
`migrate-prod.yml` calls `backup.yml` with `secrets: inherit`; a failed backup must keep stopping the migration.
## Files to touch
- `.github/workflows/backup.yml`
- `docs/environments.md` (workflow table, how to restore)
- `docs/debt.md` (repo public until Vercel Pro)
- `docs/decisions.md` (correct the claim that the repo is private)
## Steps
1. Check `gh secret list --repo ngtongsheng/gq-projects-crm` shows `BACKUP_PASSPHRASE`. Missing: mark this task blocked on the owner action and do tasks that do not depend on it.
2. Branch `fix/encrypt-backups` from the latest `origin/main`, separate from the loop branch.
3. In `backup.yml`, declare `BACKUP_PASSPHRASE` under `workflow_call.secrets` as required.
4. After the dump: fail if the passphrase is empty, tar the `backup/` folder, encrypt with `gpg --batch --pinentry-mode loopback --symmetric --cipher-algo AES256` to `prod-backup.tar.gz.gpg`, passing the passphrase by file descriptor rather than the command line.
5. In the same step, decrypt the result and compare its checksum with the tar; any mismatch fails the job.
6. Upload only `prod-backup.tar.gz.gpg`, artifact name `prod-backup-encrypted`, retention 30 days. Replace the "repo is private" comment with the real reason.
7. Grep the repo for other uses of the `prod-backup` artifact name and update them. Document restore in `docs/environments.md`: download, decrypt with the passphrase, untar.
8. Add a `docs/debt.md` row: repo public until Vercel Pro, then make it private. Fix the wrong "private" statements in `docs/environments.md` and `docs/decisions.md` only where they concern this repo's current visibility.
9. Open a pull request, wait for green checks, squash-merge to `main`, then bring the loop branch up to date.
## Acceptance
- `gh pr view <n> --json state --jq .state` prints `MERGED`.
- `git show origin/main:.github/workflows/backup.yml | grep -c "prod-backup-encrypted"` is at least 1.
- `git show origin/main:.github/workflows/backup.yml | grep -E "^\s+path: backup/"` prints nothing.
## Out of scope
Making the repo private. Deleting artifacts (task 02).
