---
model: sonnet
effort: high
why: parser logic protecting prod data; needs solid tests
depends: [01]
---
# 07 Destructive-migration guard
## Goal
A script CI runs on PRs that fails when newly added migration files contain destructive SQL.
## Context
- D5. Destructive: `DROP` (table/column/schema/function/policy/type), `TRUNCATE`, `DELETE FROM`, `ALTER ... DROP`,
  `ALTER ... RENAME`, `ALTER COLUMN ... TYPE`, `UPDATE` without `WHERE`. Ignore matches inside SQL comments and string literals.
- Also fail if an existing (already merged) migration file is modified.
- Bypass: env `OWNER_APPROVED=true` (CI sets it when PR has label `owner-approved`).
- Output: plain-language message listing file + line + statement, so the agent can explain it to Vicky.
## Files to touch
`scripts/migration-guard.ts`, `scripts/migration-guard.test.ts`, `package.json` (script `guard:migrations`)
## Steps
1. Input: list of changed files vs base branch (args or `git diff --name-status origin/main...HEAD`).
2. Strip comments/strings, scan statements, report findings; exit 1 on findings unless bypassed.
3. Tests: each destructive pattern caught; `CREATE TABLE`, `ADD COLUMN`, `CREATE POLICY` pass; comment/string false
   positives ignored; modified old migration fails; bypass works.
## Acceptance
`pnpm test` covers the cases above and passes; `pnpm guard:migrations` on the current branch exits 0.
## Out of scope
Workflow wiring (#08).
