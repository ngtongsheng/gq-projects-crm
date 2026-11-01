---
model: haiku
effort: low
why: create a repo and a tiny given file; owner runs the test
depends: []
---
# 01 Bootstrap probe
## Goal
Prove that Claude Desktop (Code mode) fetches a public raw GitHub file and follows its steps (findings row 7 only proved fetch).
## Context
- Loop D1. `docs/desktop-findings.md` row 7. GitHub via `gh` only (loop 01 D10).
- The repo is public by owner decision; it must never hold secrets or company data.
## Files to touch
New public repo `ngtongsheng/gq-setup`: `SETUP.md` (probe content, replaced in #03). In this repo: `docs/desktop-findings.md` (row 7 result).
## Steps
1. `gh repo create ngtongsheng/gq-setup --public --description "Setup instructions for the GQ CRM (no secrets)"`; clone to a scratch dir.
2. `SETUP.md` probe: three harmless steps: (a) say "Step 1 of 3" in plain words, (b) run `mkdir -p ~/gq-probe && echo SETUP-OK > ~/gq-probe/result.txt`, (c) ask a multiple-choice question "Did that work?" (Yes / No). Commit, push.
3. Write the owner message to paste into Desktop: `Please set up my computer by following https://raw.githubusercontent.com/ngtongsheng/gq-setup/main/SETUP.md`.
4. Park `blocked: owner — paste the probe message in Desktop` with that exact message. On result: check `~/gq-probe/result.txt`, record row 7 Result, delete `~/gq-probe`.
5. If Claude refused or only summarised: record fail; try a stronger message ("Fetch ... and carry out each step in it"). Still fails → add a task to loop.md for the plugin marketplace channel (D1) and log it.
## Acceptance
`gh repo view ngtongsheng/gq-setup --json visibility -q .visibility` → `PUBLIC`; row 7 shows pass/fail for following steps; `~/gq-probe` removed.
## Out of scope
Real setup content (#03).
