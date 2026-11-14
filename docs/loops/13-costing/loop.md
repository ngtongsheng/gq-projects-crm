# Loop 13: Costing
Orchestrator: sonnet/high
## Goal
The Costing module from Vicky's demo (`docs/mockup/gqp-office-demo.html`, GQC app ~436-1450, `vCost` ~1920) works for
every role that sees it: Register, New quote, Quote record with revisions and options, Below-min-margin approvals, FOB
Enquiry, client quote preview, project card link, EN/中文. Parity checked per `docs/office-parity/parity.md`. Merged to
`main`. Runs in parallel with loop 12 Sales (roadmap step 2B, drift doc `docs/office-parity/drift-new-modules.md`
"Costing").
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Tables `quotes`, `quote_revisions` (+ history rows), `quote_options`, `quote_items`, `fob_enquiries`. Items are rows with typed nullable cost columns and a check per item type | Integrity and RLS like every other record; the demo's JSON blobs are a prototype device | JSONB per revision |
| D2 | All maths in pure `src/lib/domain/costing.ts`, formulas exactly as the drift doc; DB stores `numeric`; round to 2 dp per line | Money: one tested place | Maths in components or SQL |
| D3 | Cost and margin are stripped server-side for people without the margin flag (`pages.ts` "See margin % and cost"); they see "Low / High margin" | Hiding in UI leaks via RSC payload | UI-only hiding |
| D4 | Costing strings: English source text, Chinese in `src/lib/i18n/zh.ts`; language from the loop 11 toggle, default English. Loop 12 does not edit `zh.ts` | Demo is EN/中文 with English default; no conflict | Chinese-first source text |
| D5 | Costing nav badge and low-margin dashboard banner go to the Integration loop. `vTeam` (grades J1-M2) is not built | Same as loop 12 D2; drift doc says vTeam is unreachable | Building them here |
| D6 | Min margin (30%) and default SST (10%) are `app_settings` rows; editing screen comes later | Demo has settings; no settings page yet | Hard-coded |
| D7 | Parallel with loop 12: rebase on `main` before merging; if `main` has a migration newer than ours, rename ours to a fresh timestamp. Project card edits stay in the card component (loop 12 touches only project access and filters) | Out-of-order migrations fail on push | Fixed timestamp ranges |
| D8 | One branch `loop/13-costing` in a worktree, one commit per task, one PR. Preflight: no new allow rules; loop docs pushed with `git push`; PR merge deploys and applies migrations as in loops 07-12 | Established path | - |
| D9 | Demo contradictions: follow the more specific rule, log in `docs/decisions.md` (roadmap rules) | Owner: "follow demo" | Asking each time |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Costing maths | todo | - | sonnet/high |
| 02 | Migration: costing tables, settings, RLS | todo | - | opus/medium |
| 03 | Quote loader + margin gating | todo | 01, 02 | opus/medium |
| 04 | Register + New quote | todo | 03 | sonnet/high |
| 05 | Quote record editor | todo | 03 | sonnet/high |
| 06 | Approval flow + Approvals page | todo | 05 | opus/medium |
| 07 | FOB Enquiry | todo | 05 | sonnet/high |
| 08 | Client quote preview | todo | 05 | sonnet/high |
| 09 | Project card costing lines | todo | 06 | sonnet/high |
| 10 | Chinese strings for Costing | todo | 04, 05, 06, 07, 08 | sonnet/medium |
| 11 | Dev seed: sample quotes | todo | 02 | sonnet/medium |
| 12 | Parity pass, docs, merge | todo | 01-11 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- None planned. Tell Vicky one line when it is live (message to a person, so the owner sends it).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-new-modules.md "Costing" · next: #01
