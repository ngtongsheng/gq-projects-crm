# Claude Desktop (Code mode) findings

Run this on your Mac in Claude Desktop, Code mode, inside this repo. Fill each `Result:` with `pass` or `fail` plus a
short note. For every `fail`, write the fallback we should use in the Fallback column.

Docs: https://code.claude.com/docs/en/desktop.md

| # | Behavior | What to type or click | Expected result | Result | Fallback (if fail) |
|---|----------|-----------------------|-----------------|--------|--------------------|
| 1 | AskUserQuestion multiple-choice prompt | Type: `Ask me which of three colors I like using the multiple-choice question tool, then stop.` | A question card with selectable options appears and waits for a click | Result: | |
| 2 | Project output style loads | Add the output style snippet (below) to `.claude/output-styles/probe.md` and the settings snippet to `.claude/settings.json`. Start a new session. Type: `Say hello.` | Reply starts with `PROBE-STYLE-OK` | Result: | |
| 3 | Project skill loads | Add the test skill snippet (below) to `.claude/skills/desktop-probe/SKILL.md`. Start a new session. Type `/` and look for `desktop-probe`. Run it. | Skill appears in the `/` menu and its reply is `PROBE-SKILL-OK` | Result: | |
| 4 | Worktree toggle | In a Git repo, turn on **Worktree** under the prompt box before starting a session. Type: `Run git rev-parse --show-toplevel and tell me the path.` | Path is under `.claude/worktrees/`, not the main checkout | Result: | |
| 5 | Dev server preview via launch.json | Add `.claude/launch.json` (snippet below) with the dev server config. Open the preview for the session. | Dev server starts and the app renders in the preview pane | Result: | |
| 6 | Plugin marketplace add from prompt | Type: `/plugin marketplace add <owner>/<public-repo>` with a public repo you control. | Marketplace is added and its plugins are listed | Result: | |
| 7 | Fetch public raw GitHub URL as setup | Type: `Fetch https://raw.githubusercontent.com/<owner>/<repo>/main/SETUP.md and follow the steps in it.` (use a harmless test file, e.g. one that writes `SETUP-OK` to a scratch note) | Claude fetches the file and performs the steps it lists | Result: | |

## Test snippets (drop in, then delete after testing)

`.claude/output-styles/probe.md`:

```markdown
---
name: probe
description: Test style for Desktop findings
---
Begin every reply with the exact text PROBE-STYLE-OK on its own line.
```

`.claude/settings.json` (project level):

```json
{
  "outputStyle": "probe"
}
```

`.claude/skills/desktop-probe/SKILL.md`:

```markdown
---
name: desktop-probe
description: Test skill for Desktop findings. Use when the user runs /desktop-probe.
---
Reply with exactly: PROBE-SKILL-OK
```

`.claude/launch.json` (replace the command with this repo's real dev server if different):

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "crm-dev",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "port": 3000
    }
  ]
}
```

## Notes

- Row 7 needs a public repo or gist with a raw URL. Do not use private repo content.
- Remove the probe files after the run. Do not commit the `.claude/` test snippets.
