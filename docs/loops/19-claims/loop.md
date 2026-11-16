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
| 03 | Claim flow + gates | done | 01 | opus/medium |
| 04 | My claim: sections A-C | done | 02, 03 | sonnet/high |
| 05 | Manager views + settings | done | 03 | sonnet/high |
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
2026-11-16 · #03 · in-progress · delegated opus/medium
2026-11-16 · #03 · done · check, typecheck, test, guard pass (2691) · next: #04
2026-11-16 · #03 · decision · extra migration 20261118110000 with approve_monthly_claim (atomic approve + commission_payouts) and monthly_claim_ot_amount · avoids approved claim without payouts
2026-11-16 · #03 · decision · flagged-claim remark requirement deferred to #05 (needs flag data it loads); #05 must add it in checkClaim/approveClaim and add adjustment-save actions · demo parity
2026-11-16 · #03 · decision · pay is accounts-only; pay gate uses claim month's report, submit gate last month's · as demo
2026-11-16 · #04 · in-progress · delegated sonnet/high
2026-11-16 · #04 · done · check, typecheck, test (2717), build pass; parity deferred to #09 (migrations not on test copy; also verify actions on test copy) · next: #05
2026-11-16 · #04 · decision · claimant page reads caps/meal rates via createAdminClient for that one person (packages RLS is md/accounts only); salary never reaches the page · avoids new migration
2026-11-16 · #04 · decision · commission lines start unticked (tick = DB row); section C always shown while editable; OT amount shows once a claim row exists · #06 may revisit with /overtime
2026-11-16 · #04 · decision · expense edit cannot cross claim months (delete and re-add) · simple, safe
2026-11-16 · #05 · in-progress · delegated sonnet/high
2026-11-16 · #05 · done · check, typecheck, test (2734), build pass; parity deferred to #09 · next: #06
2026-11-16 · #05 · decision · remark required on flagged claims for both accounts and md at check and approve · simpler than demo's accounts-only
2026-11-16 · #05 · decision · adjustments only while submitted/checked (payouts written at approve) · money safety
2026-11-16 · #05 · decision · waive late cut raises line to original + cut, only with an approved appeal; late_cut_waived unchanged; late1/late2 settings stay on /commission/settings (md only) · no migration
2026-11-16 · #05 · todo-for-#09 · verify on test copy: embedded profiles(...) selects in all-claims-data/claim-review-data, key:mof_id/key:id aliases in claim-review-actions, md/accounts read of others' activities and site logs, checker expense update vs guard triggers
