# Decisions

Loop 01 decisions: see `docs/loops/01-foundation/loop.md` (D1-D12).

## Context
- Client: Vicky, owner of a 17-person carpet sales + installation company. Team is non-technical.
- Product: invite-only internal CRM. Vicky vibe-codes it herself via Claude Desktop (Code mode); more editors may follow.
- Owner (ngtongsheng) builds the foundation and the setup, hosts everything on his accounts during evaluation, transfers at handover.

## Loop 02 inputs (setup skill + first run), decided 2026-11-01
- Mac first (Vicky's laptop is a Mac). Windows (winget path) in a later loop when a Windows teammate can test.
- No Homebrew (needs a typed admin password). Git via Apple's click-to-install popup; mise via user-level installer for node, pnpm, gh.
- No ZIP. Bootstrap: Vicky pastes one message into Claude Desktop pointing at a public `ngtongsheng/gq-setup` repo
  (instructions only, no secrets); Claude follows it. Fallback: public plugin marketplace. Verify both in #02 spike.
- Setup covers: GitHub account creation (plain steps), owner invites her to the repo, `gh auth login` (browser device flow), clone, install, first preview.
- After clone, the in-repo kit (CLAUDE.md, skills) takes over; updates arrive with every pull.
- Vicky on Claude Pro; upgrade later. Owner present in person for the first run on her Mac. No separate test rig.
- After handover: replace the CI destructive-change block with Claude double-confirming with Vicky.
- At handover: move to Vicky's paid Vercel Pro + Supabase Pro (commercial use, backups), company GitHub org.

### Findings from loop 01 (2026-11-02)
- Desktop spike: AskUserQuestion, project output style, project skills, worktree toggle, launch.json preview, `/plugin marketplace add` and raw-URL fetch all pass. Following written steps from a fetched URL is untested: test it end to end in loop 02.
- GitHub Free private repo has no branch protection or auto-merge (403). The deploy skill waits for `gh pr checks`, then squash-merges; the destructive-migration guard is advisory. Settings deny `git push` to main. GitHub Pro or a public repo closes the gap.
- Vercel preview links sit behind Vercel login (Deployment Protection). Decided 2026-11-02: no shared previews. Vicky and her team preview on localhost; Hobby allows one shareable link per account, made by the owner on request. Admin-only features are tried on the live site right after deploy. Revisit with Vercel Pro (team seats).
- Preview URL is read from the Vercel bot PR comment (GitHub deployments API is empty). The duplicate Vercel project `gq-projects-crm-ym4y` was deleted 2026-11-02.
- Skills may need extra allow-list entries (`gh api .../deployments`, `curl -sI`, `lsof`, `kill`, `sleep`) to avoid jargon permission prompts; owner decides.
- The dev database is shared by all open PRs: a PR missing another PR's applied migration fails `migrate-dev` until rebased.
- First admins are seeded with `scripts/seed-admin.ts` using the prod secret key from an untracked `.env.seed`; there is no change-password screen yet, so the temporary password stays until one is added.

## Loop 04 (Vicky's global agent layer), decided 2026-11-02
- The company layer (rules, plain style, tdd / diagnosing-bugs / grilling / get-help, settings, apply script) lives in
  public `ngtongsheng/gq-setup/agent/` and applies to every session on Vicky's Mac, not only this folder. Public
  because the bare-link setup must fetch it before GitHub sign-in; it holds no secrets, customer data or prices.
- The apply script runs at setup and on every SessionStart, pulling gq-setup. Risk accepted: whoever can push to
  gq-setup runs code on her Mac. Only the owner can.
- Default model is Opus on Pro. It burns the usage limit faster than Sonnet; accepted. Subagents use Sonnet.
- `get-help` is global, always filing in this private repo with a `from:crm` / `from:other` label. The CRM copy is
  removed.
- The CRM keeps a byte-identical copy of `plain.md` so it works without the global layer; CI diffs it against
  gq-setup `main`. CRM-only wording (glossary words, preview and put-it-live lines) lives in `CLAUDE.md`.
- Details: `docs/loops/04-vicky-agent-layer/loop.md`.

## Loop 03
CRM features: to be grilled after loop 02. Source: Vicky's prototype `docs/mockup/gq-crm-mockup.html` (team roster
and roles, lead pipeline, customers/designers, site activities, projects + payment claims, purchasing/POs with
supplier and warehouse statuses, deliveries, installation schedule and installers, stock/offcuts and returns, staff
OT claims, guide). The prototype is the spec input, not the data model: grill it into slices.

## Loop 07 (debt fixes), decided 2026-11-03
- D1: salespeople (bd, sales) see only projects where they are `pic_id`, `support_id` or `passed_by`; md, director,
  accounts, site and support still see all. Owner's choice, matching the prototype. Enforced by narrowing the
  projects read policy in SQL and by the projects page. Finding 55 of loop 05.
- D2: database rules are tested with `@electric-sql/pglite` (devDependency). `supabase/tests/*.test.ts` applies every
  migration to a fresh in-memory database with a stubbed `auth.uid()` and roles, and runs under `pnpm test`.
  Closes finding 3 of loop 05.
