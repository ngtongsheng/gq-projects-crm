---
model: sonnet
effort: high
why: Several aggregates (prorated targets, best month, drilldown) plus an SVG chart
depends: [02]
---
# 07 Performance deltas
## Goal
Prorated targets by join/leave ("Joined / Joins" note), tile row with Best month, row drilldown to the person's MOFs
(Sales, Margin %, Margin RM, Collected, Outstanding, Status; margin gated), team comparison panel with a monthly SVG
bar chart, Eddie-style rule: a director with no awarded sales is hidden.
## Context
- `docs/office-parity/drift-money-reports.md` "Sales Performance"; demo `annualT`. D7. Read the `dataviz` skill before the chart.
## Files to touch
- `src/lib/domain/sales-performance.ts` (+ test), `src/app/(app)/performance/page.tsx`, `performance-data.ts`,
  `team-comparison-chart.tsx` (new)
## Acceptance
- Checks pass; tests: proration for mid-year join and leave, best month ties. Parity for md, director, sales.
