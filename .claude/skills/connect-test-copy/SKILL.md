---
name: connect-test-copy
description: Connect Vicky's laptop to the test copy. Use when an admin feature says it can't be tried on her laptop, when a change needs new database changes on the test copy, or when she pastes the two values Tong Sheng sent.
---
# Connect to the test copy

One-time setup. Afterwards her laptop can use admin features and new database changes on the test copy (`gq-crm-dev`),
never the live app. Talk in the `plain` style. The two values are secrets: never print them, quote them back, write
them anywhere except through step 3, or put them in a commit, issue or note.

## 1. See what is already set
1. Run `pnpm copy-env`. A new worktree has no `.env.local`; this copies it from the main folder when that has one.
2. Run `grep -o "^SUPABASE_[A-Z_]*" .env.local` (prints names only, never values).
3. Done when you know whether `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DEV_DB_URL` are both listed. Both listed: say
   "Your laptop is already connected to the test copy." and stop. Otherwise continue.

## 2. Ask for the two values
Plain text, no prompt: "Tong Sheng sent you two things, a long code starting with `sb_secret_` and a password.
Please paste both here in one message." She does not have them: use `get-help` to ask him, then stop.

## 3. Save them
Pass her pasted message to `pnpm connect:test-copy` on standard input, exactly as she wrote it, in a quoted heredoc
(`<<'EOF'`, her values on the lines between, `EOF` to close).

The script checks the key against the test copy, then writes `.env.local` (gitignored) and prints one line. Done when
that line starts with "Connected". On an error, one fix attempt at most (typically a stray character in the paste:
ask her to paste again). A key the test copy does not accept goes to `get-help`.

## 4. Check the database password
Run `pnpm db:test-copy`. Done when it ends with "up to date" or lists the changes it applied. A connection or login
error means the password is wrong or the address changed: `get-help`.

## 5. Finish
Stop any running preview with `pnpm free-port` so the next one picks up the new settings. Tell her in one line: "Your
laptop is connected to the test copy. Admin features and database changes now work in the preview."
