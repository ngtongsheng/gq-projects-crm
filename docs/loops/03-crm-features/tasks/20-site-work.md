---
model: sonnet
effort: high
why: several related sub-tables, phone layout
depends: [17]
---
# 20 Site stage, site log, follow-ups
## Goal
Site Work lists active MOFs with site stage %; supervisors log visits (activity, notes, flags, Drive link) and follow-up actions with an owner and done flag.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Site Work`, `Touch Up`, `follow-up`, `Installation in progress`, `saved to Drive`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_site_work.sql
- src/app/(app)/site-work/page.tsx
- src/app/(app)/site-work/[mofId]/page.tsx
- src/app/(app)/site-work/actions.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. Add `site_stage` to mofs (check of 6, default start) and tables `site_logs` (mof_id, visited_on, supervisor_id, activity, notes, measurement_received, drive_link, handover_signed) and `site_follow_ups` (site_log_id, action, owner_group check of 6, due_on, done_at). RLS: read all; write md/director/site; follow-up done by anyone in its owner group or managers.
2. Stage % from a pure map in `src/lib/domain/site-stage.ts` (put it in the actions test file's subject or its own tested file; stay within 5 files by testing through actions if needed).
## Acceptance
- Tests: stage %; Drive link must be a URL; permission.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
OT (#21), leftover (#22).
