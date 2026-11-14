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
| 01 | Costing maths | done | - | sonnet/high |
| 02 | Migration: costing tables, settings, RLS | done | - | opus/medium |
| 03 | Quote loader + margin gating | done | 01, 02 | opus/medium |
| 04 | Register + New quote | done | 03 | sonnet/high |
| 05 | Quote record editor | done | 03 | sonnet/high |
| 06 | Approval flow + Approvals page | done | 05 | opus/medium |
| 07 | FOB Enquiry | done | 05 | sonnet/high |
| 08 | Client quote preview | done | 05 | sonnet/high |
| 09 | Project card costing lines | done | 06 | sonnet/high |
| 10 | Chinese strings for Costing | done | 04, 05, 06, 07, 08 | sonnet/medium |
| 11 | Dev seed: sample quotes | done | 02 | sonnet/medium |
| 12 | Parity pass, docs, merge | blocked: owner - seed.dev file missing, parity not run | 01-11 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- None planned. Tell Vicky one line when it is live (message to a person, so the owner sends it).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-new-modules.md "Costing" · next: #01
2026-11-15 · #01 · in-progress · worktree ../gq-projects-crm-loops/13-costing
2026-11-15 · #02 · decision · directors read all quotes (demo + drift doc; task 02 acceptance said own team, Context said all) · D9 follow demo
2026-11-15 · #01 · done · costing.ts + 27 tests, check/typecheck/test pass
2026-11-15 · #01 · decision · added `simple` item type (demo has it); per-line 2 dp rounding per D2; margin is a fraction, null when sell 0; `supply only` flag replaces demo cat check (loader maps it); no lowest-margin-across-options helper yet · task 06/03 adds it
2026-11-15 · #02 · in-progress
2026-11-15 · #02 · done · migration 20261115120000_costing.sql, 65 RLS tests, check/typecheck/guard/test pass
2026-11-15 · #02 · decision · migration timestamp 20261115120000 (clock sorted before existing); sixth table quote_revision_history; FOB enquiry quote_no is free text; sales/bd manage own enquiries, md/director/support/accounts work all · demo rules
2026-11-15 · #02 · decision · cost-column API exposure and role-based (not page-matrix) read logged in docs/debt.md; self-approve enforcement added to task 06, example-data reset note to task 11 · needs D1 change / not in scope
2026-11-15 · #03 · in-progress
2026-11-15 · #03 · done · quote-view.ts, quote-data.ts + tests; check/typecheck/test pass
2026-11-15 · #03 · decision · restricted view also drops fx, SST, target margin, wastage, supplier price per piece; empty option has null level; register "updated" = later of quote/revision · cost-only fields
2026-11-15 · #03 · decision · D3 holds in editor: viewers without margin flag edit sell-side only (added to task 05); no margin/cost in history notes (added to task 06) · demo hides cost without flag; owner may want a sales exception
2026-11-15 · #04 · in-progress
2026-11-15 · #04 · done · register, new quote, createQuote action + tests; check/typecheck/test pass (1433)
2026-11-15 · #04 · decision · per-task desktop/390px parity needs the test copy and role panel (environment step); deferred to task 12 parity pass · acceptance covers it once
2026-11-15 · #04 · decision · register shows lowest-option margin and highest sell (register row carries only that); `-R<n>` quote no rejected, revision copy belongs to 05/06; createQuote non-transactional, editor copes (added to task 05) · demo has per-option values
2026-11-15 · #05 · in-progress
2026-11-15 · #05 · done · /costing/[id] editor, revision-actions + 34 tests; check/typecheck/test pass (1467)
2026-11-15 · #05 · decision · editor is line cards with category select (not per-category tables); project/customer read-only; no unsaved-edit warning, history list, Versions panel or auto "Installation for X" text · outside goal; save/add/remove option are multi-write (debt.md row)
2026-11-15 · #05 · decision · lines keyed without margin flag have cost 0; task 06 blocks owner self-confirm unless every non-discount line has cost keyed and lowest margin >= min · avoids bypass. Owner may later want a sales cost exception
2026-11-15 · #06 · in-progress
2026-11-15 · #06 · done · approval actions, readiness/decideStep, Approvals page, history list; check/typecheck/test pass (1526)
2026-11-15 · #06 · decision · approvers may decide their own costing (demo; subagent's self-approval block removed per D9); sent-low costing cannot be resent; Recently decided lists only approval-route costings; choosing the customer option is not undoable; History list added to the costing page · demo parity / needed for return notes
2026-11-15 · #07 · in-progress
2026-11-15 · #07 · done · enquiries page, panel, actions + 29 tests; check/typecheck/test pass (1555)
2026-11-15 · #07 · decision · only md/director/support/accounts reply (app-enforced, debt.md row); landed cost is display only, no "use in line" button; no Copy to WhatsApp or Mine toggle; sales may delete only pending enquiries; size parser splits on ", " to fix demo thousands-separator bug · spec says purchasing replies
2026-11-15 · #08 · in-progress
2026-11-15 · #08 · done · /costing/[id]/preview, toClientQuote, TSV + tests; check/typecheck/test pass (1565)
2026-11-15 · #08 · decision · Chrome print comparison deferred to task 12 (needs test copy); compare view shows product name only (no rug size); compare prints portrait A4 (check in 12); added toolbarActions prop to print-layout.tsx and a Client quote button on the record · demo parity / needed to reach preview
2026-11-15 · #09 · in-progress
2026-11-15 · #09 · done · project-costing-lines, setValueFromCosting + 14 tests; check/typecheck/test pass (1579)
2026-11-15 · #09 · decision · action named setValueFromCosting (lint rejects use* prefix); lines on the Projects board card only (not list view, customer-projects or edit dialog); matched by project_id only; only the newest revision counts; value is 2 dp sell · minimal card edit per D7
2026-11-15 · #10 · in-progress
2026-11-15 · #10 · done · ~295 zh.ts entries, LanguageProvider/useT/getT, Noto Sans SC; check/typecheck/test pass (1579)
2026-11-15 · #10 · decision · language reaches client components via new context in (app)/layout.tsx (only sidebar used t() before); Noto Sans SC via next/font/google (no npm package, preload false); client quote sheet and TSV stay English; value-bearing server messages and metadata titles English only (debt.md row) · no existing mechanism; customer-facing sheet is English in demo
2026-11-15 · #11 · in-progress
2026-11-15 · #11 · done · scripts/example-data/quotes.ts, reset handles quote FK, idempotence proved on PGlite; check/typecheck/test pass (1583)
2026-11-15 · #11 · decision · six quotes (two below 30%: submitted 24%, returned 26%), fixed m2 areas, chosen_option_id null, replied_by/at omitted (trigger) · demo parity / DB constraints
2026-11-15 · #12 · in-progress · orchestrator splits: subagent does parity + docs; orchestrator does rebase, PR, merge
2026-11-15 · #12 · partial · docs done (features, decisions, drift doc, roadmap 2B); costing migration applied to test copy via pnpm db:test-copy; `pnpm seed:example` failed: `.env.seed.dev` not found, so Chrome parity (7 screens x 6 roles x 2 widths, print compare, Chinese) not run · not merged: parity is part of the goal and `cost` is now a built page
2026-11-15 · #12 · blocked: owner · put `.env.seed.dev` (test copy service credentials) in ~/work/projects/gq-projects-crm-loops/13-costing, then re-run /execute-loop docs/loops/13-costing to do parity, rebase, PR and merge
