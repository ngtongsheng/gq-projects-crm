# Loop 19: Claims
Orchestrator: opus/medium
## Goal
Monthly claims (commission lines, travel expenses with receipts, OT folded in), manager views, appeals tab, settings and
print match Vicky's demo (`vClaims` ~4240) per `docs/office-parity/drift-money-reports.md` "Claims" (roadmap step 4A).
Parity per `docs/office-parity/parity.md`. Merged to `main`. Starts after loops 14 and 16 merge (lane A after 14).
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | One claim per person per month; cut-off day setting (default 25), dates after it roll to next month. Flow Draft → Submitted → Checked (`accounts`) → Approved (`accounts` or `md`) → Paid; Returned allowed from Submitted/Checked. Roles, never names ("Jany" = accounts, "Vicky" = md, "Eddie" = director) | Demo; loop 14 D6 | Name rules |
| D2 | Commission lines come from the existing commission data (90%+ paid), late cut shown; a line in a pending claim cannot be claimed again (DB constraint) | Demo; money safety | UI-only check |
| D3 | OT stays in its existing tables; section C sums the month's approved OT and replacement leave. The `/overtime` page leaves the nav; its form opens from Claims. OT approvers: director, md or accounts | Reuse; no data moved | Migrating OT rows |
| D4 | Receipts R1, R2… are images via loop 11 storage (downscaled like the MC slip); none for mileage. Caps from HR packages (loop 16 `staff_package` on the claim date) | Reuse | New upload path |
| D5 | Flags (no visit logged that day, hotel over budget, meals twice, >150 km/day, monthly petrol+toll+parking cap) warn, never block; checker sees them | Demo | Blocking |
| D6 | Submit gate `needRep`: last month's report submitted; `clRepOk` needs it reviewed + md approved (loop 14 two-step) | Demo | - |
| D7 | Appeals tab moves from Commission (loop 14 D4) into Claims; Commission keeps a link | Loop 14 D4 | Two tabs |
| D8 | One branch `loop/19-claims` from `main` after 14 and 16 merge, one commit per task, one PR. Rebase before merging. Preflight: none; PR merge deploys as in loops 07-18. Demo contradictions: specific rule wins, logged | Established path | - |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Claims migration | done | - | opus/medium |
| 02 | Claim maths + flags | done | 01 | opus/medium |
| 03 | Claim flow + gates | todo | 01 | opus/medium |
| 04 | My claim: sections A-C | todo | 02, 03 | sonnet/high |
| 05 | Manager views + settings | todo | 03 | sonnet/high |
| 06 | Appeals tab move + OT fold-in | todo | 04 | sonnet/high |
| 07 | Claim print | todo | 04 | sonnet/medium |
| 08 | Strings + dev seed | todo | 04, 05, 06, 07 | sonnet/medium |
| 09 | Parity pass, docs, merge | todo | 01-08 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Start only after loops 14 and 16 are merged: `/execute-loop docs/loops/19-claims`.
- After go-live, tell Vicky (owner sends): overtime is now claimed inside the monthly claim.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-money-reports.md (Claims) · next: wait for loops 14 + 16, then #01
2026-11-16 · exec · worktree ../gq-projects-crm-loops/19-claims on loop/19-claims; 14 and 16 merged (PR #46, #47) · next: #01
2026-11-16 · #01 · in-progress · delegated opus/medium
2026-11-16 · #01 · done · check, typecheck, test, guard pass · next: #02, #03
2026-11-16 · #01 · decision · OT approvers (D3) policy on ot_claims changed in this migration (md/director/accounts); #06 needs only app code · no migration slot in #06
2026-11-16 · #01 · decision · pending = submitted/checked/approved; paid frees the commission line, so #03 must write commission_payouts at approve · avoids double pay
2026-11-16 · #01 · decision · late1/late2 settings stay in `commission` key (accounts cannot write it); claim settings key `claims` · no duplication
2026-11-16 · #01 · decision · approver/checker and times live in monthly_claim_log only; claimant `note` field added · demo says appeals go in note
2026-11-16 · #02 · in-progress · delegated opus/medium
2026-11-16 · #02 · done · check, typecheck, test pass (2640) · next: #03
2026-11-16 · #02 · decision · monthly cap = petrol+toll+parking, mileage excluded (D5 and HR package label win over demo CAP_TYPES) · specific rule wins
2026-11-16 · #02 · decision · cap 0 = no cap; monthly cap uses package on cut-off date, hotel budget on each line's date; travel-limit flag only when cap flag absent · as demo
