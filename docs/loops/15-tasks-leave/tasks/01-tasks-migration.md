---
model: opus
effort: medium
why: New schema with multi-assignee RLS across job roles; everything else builds on it
depends: []
---
# 01 Tasks migration
## Goal
Tables for tasks (title, category, optional project, assigner, priority Low-Urgent, due, status, revision count),
co-assignees, log entries and file versions, with RLS per D4: assignees and assigner see a task; md/director see all.
## Context
- `docs/office-parity/drift-new-modules.md` "Tasks"; demo `vTasks` ~3104 (11 categories, statuses).
- RLS pattern and `is_active()` helpers: latest migrations in `supabase/migrations/`, `docs/decisions.md`.
- Files: `src/lib/storage/attachment-rules.ts` (D6).
## Files to touch
- `supabase/migrations/<ts>_tasks.sql` (new), `supabase/tests/tasks.test.ts` (new), generated DB types
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: RLS per job role (assignee,
  co-assignee, assigner, md, unrelated staff, left person).
