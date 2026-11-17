---
tier: standard
why: aggregation logic with month-over-month change plus an SVG chart
depends: [10]
---
# 11 Marketing dashboard and chart
## Goal
Dashboard view per spec: tiles, category x month table with change row, stacked bar chart, top vendors and events
panels; cells and vendors jump to a filtered log. Low-balance banners come in 14.
## Context
Read `00-shared-context.md`. Decision D9. Spec `demo-changes.md` §2.2. Read the `dataviz` skill if available for
colour rules; colours from theme tokens.
## Files to touch
`src/app/(app)/marketing/` dashboard data + pure aggregation module + test, dashboard view, chart component.
## Acceptance
- Aggregation tests: totals per category/month, average over months with spend, highest month, change % only when
  both months > 0, year filter.
- `pnpm check && pnpm typecheck && pnpm test` pass; parity (md, ssup).
## Out of scope
Prepaid banner data (14 adds it).
