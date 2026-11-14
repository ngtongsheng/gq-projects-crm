---
model: opus
effort: medium
why: Money and dates: cut-off rollover, mileage, caps, flags
depends: [01]
---
# 02 Claim maths + flags
## Goal
Pure functions: claim month for a date (cut-off), mileage amount, totals per section, caps from HR package on date
(D4), flags per D5, original vs final diff.
## Files to touch
- `src/lib/domain/monthly-claim.ts` (+ test)
## Acceptance
- `pnpm test` passes. Tests: cut-off boundary (25th vs 26th, Dec → Jan), each flag, cap exceeded, rounding to sen.
