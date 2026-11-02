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
- The kit (`CLAUDE.md`, `.claude/skills`, `.claude/settings.json`) lives in the CRM repo. It reaches her through
  `main`: merge to `main` and it arrives.
- At the start of each session `CLAUDE.md` tells Claude to run `git pull --ff-only` when the folder is on `main` with
  no pending changes. If she is mid-change on another branch, the pull is skipped and the update arrives next session.
- Setup instructions (`gq-setup`) are fetched fresh from the public URL each time she pastes the message, so a fix to
  `SETUP.md` reaches her on the next paste.
- If her folder is broken or stuck behind: she pastes the setup message again. Step 7 pulls the latest when it is
  safe, and leaves her work alone when it is not.

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
