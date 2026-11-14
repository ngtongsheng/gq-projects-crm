---
model: opus
effort: medium
why: Five related tables with role- and ownership-based RLS; a mistake leaks cost data
depends: []
---
# 02 Migration: costing tables, settings, RLS
## Goal
Tables for D1, settings for D6, RLS for every job role.
## Context
- Entities and fields: drift doc "Costing" Entities bullet. Quote no format: copy from the demo.
- Access: salespeople own their quotes (team leads read their team's, per loop 11 D6 helpers `in_my_team`,
  `has_job_role` in `supabase/migrations/20261114130000_team_scoping_sales.sql`); md, director, support (purchasing),
  accounts read all. md and director approve/return. Purchasing writes FOB enquiry replies.
- Revision status: draft / submitted / approved / returned; edit allowed in draft, returned, submitted.
- `quotes.project_id` nullable FK to `projects`.
- D7: timestamp at time of writing; `pnpm guard:migrations` passes.
## Files to touch
- `supabase/migrations/<ts>_costing.sql` (new)
- `supabase/tests/costing.test.ts` (new)
- generated DB types if the repo has them
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. RLS tests: sales reads own only; director
  reads all (demo rule); support reads all and edits enquiries only; site role reads nothing; approved revision not editable.
## Out of scope
UI, loader.
