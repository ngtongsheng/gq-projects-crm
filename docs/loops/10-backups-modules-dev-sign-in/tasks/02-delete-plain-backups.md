---
model: sonnet
effort: high
why: Irreversible deletion of restore points; must be strictly ordered and exact about names
depends: [01]
---
# 02 Fresh encrypted backup, delete plain ones
## Goal
A verified encrypted backup exists on GitHub and no plain `prod-backup` artifact remains.
## Context
Owner approved deleting the plain artifacts once a fresh encrypted backup exists (D4). Never download or open a plain `prod-backup` artifact. Never decrypt a backup.
## Files to touch
None.
## Steps
1. `gh workflow run backup.yml --ref main --repo ngtongsheng/gq-projects-crm`, find the run, `gh run watch <id> --exit-status`. Failure: stop and mark blocked; delete nothing.
2. `gh run download <id> -n prod-backup-encrypted -D <scratch dir>`. Confirm the only file is `prod-backup.tar.gz.gpg`, that `file` identifies it as GPG encrypted data, and that its size is above zero. Delete the scratch copy.
3. List artifact ids with `gh api --paginate "repos/ngtongsheng/gq-projects-crm/actions/artifacts?name=prod-backup" --jq '.artifacts[].id'`. Delete each with `gh api -X DELETE repos/ngtongsheng/gq-projects-crm/actions/artifacts/<id>`. Check every listed name is exactly `prod-backup` first.
## Acceptance
- `gh api "repos/ngtongsheng/gq-projects-crm/actions/artifacts?name=prod-backup" --jq .total_count` prints `0`.
- `gh api "repos/ngtongsheng/gq-projects-crm/actions/artifacts?name=prod-backup-encrypted" --jq .total_count` is at least `1`.
## Out of scope
Reading backup contents. Password rotation or notifying anyone (owner action).
