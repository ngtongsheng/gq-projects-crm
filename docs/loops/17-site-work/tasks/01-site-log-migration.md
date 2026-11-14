---
model: opus
effort: medium
why: Extends a live table and adds new ones; RLS for site, sales, marketing
depends: []
---
# 01 Site log migration
## Goal
Per D2/D5: extend `site_logs` (multi activities, inst_pct, measurement to/sent_at/received, shooting
to/sent/saved/link, completed photos, delivery ok/problem, handover signed, return answer, nullable MOF + free-text
site + salesperson + optional pipeline project); `site_off` (office/other, date range); `shoot_requests`; follow-up
assignee group, due, still-waiting log, snooze until. RLS: site role writes own; marketing reads only shooting and logs.
## Context
- `supabase/migrations/20261103100000_site_work.sql`, `src/app/(app)/site-work/site-work-data.ts`.
- `docs/office-parity/drift-site-stock.md` "Log work" "New data".
## Files to touch
- `supabase/migrations/<ts>_site_log_parity.sql` (new) + test, generated DB types
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: existing logs unchanged; RLS per role; log without MOF.
