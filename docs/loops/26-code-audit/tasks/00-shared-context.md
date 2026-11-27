# Shared context for every task in loop 26
- Read `CLAUDE.md` (engineering bar, database rules) first. Work on branch `loop/26-code-audit` in its worktree.
- Checks: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build`. All must pass before a task is done.
- Fix policy (D3): only changes that keep behavior identical. Behavior, schema, migration, RLS, route or UI
  changes are findings for `docs/debt.md`, not fixes. Never edit an applied migration.
- Audit report: `docs/audits/2026-11-27-code-audit-round-3.md`. Rounds 1-2 for format and to avoid repeats:
  `docs/audits/2026-11-16-code-audit.md`, `docs/audits/2026-11-16-code-audit-round-2.md`. Findings already in
  `docs/debt.md` are not new findings.
- Finding IDs: `A<n>` (task 05), `B<n>` (task 06). Each row: ID, finding, evidence (`file:line`), impact,
  `fix: 07|08|09` or `debt`.
- Vicky's team will keep editing this code with agents after handover: clear names and small files matter more
  than cleverness.
- Commits: small, conventional, one per logical change.
