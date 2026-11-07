---
name: test-sign-ins
description: Give Vicky a sign-in for each job role on the test copy. Use when she wants to see the app as the MD, director, BD, sales, accounts, site or support, or says a test password stopped working.
---
# Test sign-ins

Gives each job role on the test copy (`gq-crm-dev`) a sign-in with a new password, so she can see the app as that
person. On the live app she uses "Sign in as" instead; this is for her laptop. Talk in the `plain` style.

## Steps
1. Run `pnpm copy-env`, then `grep -c "^SUPABASE_SERVICE_ROLE_KEY=" .env.local`. Not 1: use the `connect-test-copy`
   skill first, then come back.
2. Run `pnpm reset:sign-ins`. It refuses anything but the test copy and prints one row per job role. Done when it
   printed 7 rows (md, director, bd, sales, accounts, site, support). Fewer rows or an error: `get-help`.
3. Show her a table with the columns Role, Email, Password, copied from the output. The passwords are for this chat
   only: do not write them to a file, note, commit or issue.
4. Tell her: open `http://localhost:3000`, sign in with one row, and sign out to switch role. Running this again
   changes every password, so the earlier ones stop working.
