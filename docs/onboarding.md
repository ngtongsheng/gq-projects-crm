# Onboarding an editor

For the owner (Tong Sheng). One editor at a time; Vicky is the first. `<login>` is the editor's GitHub username.
Editors get write access (D4): they can push branches and open pull requests, not change settings, secrets or rules.

## 1. Before the day: invite
1. Ask the editor for her GitHub username. If she has no account yet, the setup walks her through making one; invite
   her after she tells you the username (setup step 6 waits for this).
2. Send the invite:
   ```
   gh api -X PUT repos/ngtongsheng/gq-projects-crm/collaborators/<login> -f permission=push
   ```
3. Confirm it is pending (`expired` must be `false`):
   ```
   gh api repos/ngtongsheng/gq-projects-crm/invitations --jq '.[] | {id, login: .invitee.login, expired, created_at}'
   ```
   An empty list after a PUT means she was already a collaborator, or the call failed. Check with
   `gh api repos/ngtongsheng/gq-projects-crm/collaborators --jq '.[].login'`.
4. Invites expire after 7 days. Expired or lost: cancel and resend.
   ```
   gh api -X DELETE repos/ngtongsheng/gq-projects-crm/invitations/<id>
   gh api -X PUT repos/ngtongsheng/gq-projects-crm/collaborators/<login> -f permission=push
   ```
   Claude accepts the invite for her during setup, so she never has to click the email.

## 2. First-run script (you sit beside her)
**Before**
- Her Claude Pro login works (sign in once at claude.ai to check). Laptop charged and on wifi. Block about 45 minutes.
- Her GitHub username is invited (section 1), or the setup will pause at step 6 until you send it.

**During**
1. Claude Desktop is already installed and signed in (Pro). She opens the **Code** tab, makes and chooses the `GQ`
   folder, leaves permissions on **Manual**, and pastes the link `https://github.com/ngtongsheng/gq-setup`.
2. Claude runs `SETUP.md` and asks her to press **Allow** at each step.
3. Watch for the Apple developer tools window (step 1). It takes 5 to 15 minutes; tell her it is normal and to press
   **Install**, then **Agree**.
4. At the GitHub sign-in (step 5) she pastes the 8-character code in the browser. Stay with her if she is making a new
   account.
5. If a step stops twice, Claude tells her to send you a screenshot. Fix the cause, then she pastes the same link
   again: setup skips what is done (D5).
6. Hand-off: she quits Claude with Command + Q, reopens it, picks the **Code** tab and the folder `GQ/gq-projects-crm`.

**After**
- She asks for one tiny visible change (for example a different wording on a button) and looks at it with the preview.
  Do not deploy on day one: stop after she has seen it, and close the pull request.
- Tell her: next time, open Claude, **Code** tab, folder `GQ/gq-projects-crm`.

## 3. Updates (day 2 onward)
- `get-help`, the plain style, the company rules and the shared skills come from the public gq-setup repo
  (`agent/`), applied at session start. The CRM keeps only a byte-identical copy of the plain style, which CI checks
  against gq-setup; to change the style, edit gq-setup first, then copy it here.
- The kit (`CLAUDE.md`, `.claude/skills`, `.claude/settings.json`) lives in the CRM repo. It reaches her through
  `main`: merge to `main` and it arrives.
- A session hook (`scripts/agent/session-sync.mjs`) pulls `main` when her folder is clean and otherwise only fetches,
  so a change in progress is never disturbed. Rules, skills and hooks load from the session after the one that pulled.
  First rollout of loop 09: tell her "Open a new chat, say *get the latest CRM*, then close it and open another."
- Steer her agent from your phone: open an issue in the CRM repo with the label `for:vicky-claude` (only issues you
  write count). Her agent does it in the background, ships it, comments and closes the issue. A `from:crm` issue she
  filed with `get-help` also counts once you reply on it. See `docs/environments.md` "Agent hooks and permissions".
- Setup instructions (`gq-setup`) are fetched fresh from the public URL each time she pastes the message, so a fix to
  `SETUP.md` reaches her on the next paste.
- If her folder is broken or stuck behind: she pastes the setup message again. Step 7 pulls the latest when it is
  safe, and leaves her work alone when it is not.

## 3a. Test copy access (once per laptop)
So she can try database and admin-only features herself. Send her the `gq-crm-dev` secret key and database password
privately (WhatsApp, never git or an issue), and tell her to give both to Claude when asked. Details and your own check
commands: `docs/environments.md` "Trying database changes from a laptop".

## 3b. Windows
`SETUP.md` has a Windows path (winget for Git, mise for gh, Node and pnpm) that has not run on a real PC yet
(`docs/debt.md`). First time: sit beside her, or have her paste the link and send you a screenshot of any step that
stops. Quit Claude fully and reopen it after setup, then start a new session.

## 4. Off-boarding
Remove access and cancel any invite that was never accepted:
```
gh api -X DELETE repos/ngtongsheng/gq-projects-crm/collaborators/<login>
gh api repos/ngtongsheng/gq-projects-crm/invitations --jq '.[] | select(.invitee.login == "<login>") | .id'
gh api -X DELETE repos/ngtongsheng/gq-projects-crm/invitations/<id>
```
The first command removes an accepted collaborator; the second and third cancel a pending invite (skip them when the
second prints nothing). Her open pull requests stay; close or take them over yourself.

Out of scope here: handover to Vicky's own GitHub, Vercel and Supabase accounts (see `docs/decisions.md`).
