---
tier: standard
why: several small edits across hook, agent rules, skills and two UI spots
depends: [03]
---
# 05 Hook, CLAUDE.md, skills and laptop UI fixes
## Goal
Every session runs catch-up first without her asking, the skills rely on it instead of manual steps, and the laptop
app never shows a dead end.
## Context
- Loop D5, D8. Use the `writing-for-agents` skill for CLAUDE.md and skill edits; keep CLAUDE.md lean.
- `scripts/agent/session-sync.mjs`: after its pull, when the catch-up stamp (#03) is stale vs the current lockfile /
  migrations / seed / whats-new hashes, print one line: "Laptop update due: run `pnpm catch-up` before anything else."
  Export the staleness check from `catch-up.mjs` (`isCatchUpDue()`), no duplicate hashing. Test in
  `session-sync.test.ts`.
- CLAUDE.md: new short section "Start of session" before "Tidy-up": run `pnpm catch-up` (main folder), relay its line
  and any what's-new in plain words; on exit 1 fix the named step using `docs/laptop.md` (#06). Link `docs/laptop.md`
  under "Where things live".
- `.claude/skills/preview/SKILL.md` steps 1-3 and the reset:sign-ins line: replace with "run `pnpm catch-up`".
  `.claude/skills/connect-test-copy/SKILL.md`: becomes the fallback when catch-up cannot fetch keys (no GitHub access);
  say so in its description.
- UI (find with grep): `src/components/app/dev-role-panel.tsx` empty list → message "Your laptop isn't set up for
  test sign-ins yet. Ask Claude to set up your laptop." `src/lib/supabase/admin.ts` `ADMIN_UNAVAILABLE_MESSAGE` → drop
  "preview link"; say it works on the live app or after Claude sets up the laptop. `src/app/(auth)/sign-in/page.tsx`:
  hide the Google button when `process.env.NODE_ENV === "development"` and show a line pointing to the "Sign in as"
  panel at the bottom. Messages go through the i18n strings if the file uses them (check `src/lib/i18n`).
- `docs/environments.md:94` "expect 7 sign-ins" → 17; "Trying database changes from a laptop" → catch-up first,
  WhatsApp paste as fallback.
## Files to touch
- `scripts/agent/session-sync.mjs`, `scripts/agent/session-sync.test.ts`, `scripts/agent/catch-up.mjs` (export)
- `CLAUDE.md`, `.claude/skills/preview/SKILL.md`, `.claude/skills/connect-test-copy/SKILL.md`
- `src/components/app/dev-role-panel.tsx`, `src/lib/supabase/admin.ts`, `src/app/(auth)/sign-in/page.tsx` (+ i18n file
  if used), `docs/environments.md`
## Steps
1. Hook + test, then CLAUDE.md and skills, then UI, then docs.
2. Check the sign-in page on `pnpm dev` in Chrome ("Agent"): no Google button, hint visible; panel lists 17 people.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- Browser check above done (screenshot in the log line is not needed; say what was seen).
## Out of scope
Playbook content (#06). Live app sign-in page (unchanged outside development).
