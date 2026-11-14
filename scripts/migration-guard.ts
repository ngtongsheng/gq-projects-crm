// Fails CI when a PR adds destructive SQL to supabase/migrations, or edits a
// migration that is already merged (decision D5).
//
// Usage: node scripts/migration-guard.ts [STATUS:path ...]
// With no args it diffs against origin/main. Args use git's name-status
// letters, e.g. `A:supabase/migrations/001_x.sql`, `M:supabase/migrations/000_y.sql`.
// DATA_LOSS_APPROVED=true lets findings through (CI sets it from the PR label).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export type FileChange = { status: string; path: string };
export type Finding = {
  file: string;
  line: number;
  statement: string;
  reason: string;
};

const MIGRATION_PATH = /^supabase\/migrations\/[^/]+\.sql$/;

const BLANK = " ";
const WORD_CHAR = /[A-Za-z0-9_]/;
const DOLLAR_TAG = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/y;

/**
 * Blanks comments, string literals and quoted identifier text so keyword
 * scanning cannot be fooled by them. Length and newlines are preserved so
 * offsets still map to line numbers in the original file.
 *
 * Dollar-quoted bodies are blanked too (function bodies only run later),
 * except for `DO $$ ... $$` blocks, which run immediately and stay visible.
 */
export function stripSqlNoise(sql: string): string {
  const out: string[] = [];
  let i = 0;
  let statementHead = "";
  let doTag: string | null = null;

  const blank = (ch: string) => (ch === "\n" ? "\n" : BLANK);
  const emit = (text: string, visible: boolean) => {
    for (const ch of text) {
      out.push(visible ? ch : blank(ch));
    }
    if (visible) statementHead += text;
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      emit(sql.slice(i, stop), false);
      i = stop;
    } else if (ch === "/" && next === "*") {
      // Postgres block comments nest.
      let depth = 0;
      let j = i;
      while (j < sql.length) {
        if (sql.startsWith("/*", j)) {
          depth++;
          j += 2;
        } else if (sql.startsWith("*/", j)) {
          depth--;
          j += 2;
          if (depth === 0) break;
        } else {
          j++;
        }
      }
      emit(sql.slice(i, j), false);
      i = j;
    } else if (ch === "'") {
      const prev = sql[i - 1];
      const before = sql[i - 2];
      const escapeString =
        (prev === "E" || prev === "e") &&
        (before === undefined || !WORD_CHAR.test(before));
      let j = i + 1;
      while (j < sql.length) {
        if (escapeString && sql[j] === "\\") {
          j += 2;
        } else if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
        } else if (sql[j] === "'") {
          break;
        } else {
          j++;
        }
      }
      const stop = Math.min(j + 1, sql.length);
      emit("'", true);
      emit(sql.slice(i + 1, stop - 1), false);
      if (j < sql.length) emit("'", true);
      i = stop;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') j += 2;
        else if (sql[j] === '"') break;
        else j++;
      }
      const stop = Math.min(j + 1, sql.length);
      // Underscores keep the identifier a single token.
      emit('"', true);
      out.push("_".repeat(Math.max(0, stop - i - 2)));
      statementHead += "_";
      if (j < sql.length) emit('"', true);
      i = stop;
    } else if (ch === "$" && (i === 0 || !WORD_CHAR.test(sql[i - 1]))) {
      DOLLAR_TAG.lastIndex = i;
      const match = DOLLAR_TAG.exec(sql);
      if (!match) {
        emit(ch, true);
        i++;
      } else if (doTag === match[0]) {
        emit(match[0], false);
        doTag = null;
        i += match[0].length;
      } else if (/^\s*do\s*$/i.test(statementHead)) {
        emit(match[0], false);
        doTag = match[0];
        i += match[0].length;
      } else {
        const close = sql.indexOf(match[0], i + match[0].length);
        const stop = close === -1 ? sql.length : close + match[0].length;
        emit(sql.slice(i, stop), false);
        i = stop;
      }
    } else {
      emit(ch, true);
      if (ch === ";") statementHead = "";
      i++;
    }
  }
  return out.join("");
}

function hasTopLevelWhere(statement: string): boolean {
  let depth = 0;
  const token = /\(|\)|\bwhere\b/gi;
  for (const m of statement.matchAll(token)) {
    if (m[0] === "(") depth++;
    else if (m[0] === ")") depth--;
    else if (depth === 0) return true;
  }
  return false;
}

// Objects that hold no stored rows: dropping one loses a definition, not data.
const DEFINITION_ONLY_DROP =
  /^drop\s+(?:policy|function|trigger|view|index)\b/i;

// `drop constraint c, add constraint c ...` in one statement replaces a rule and keeps every row:
// a stricter rule makes the migration fail instead of removing data.
function dropsOnlyReplacedConstraints(sql: string): boolean {
  const added = new Set(
    [...sql.matchAll(/\badd\s+constraint\s+(\w+)/gi)].map((m) =>
      m[1].toLowerCase(),
    ),
  );
  const rest = sql.replace(
    /\bdrop\s+constraint\s+(?:if\s+exists\s+)?(\w+)/gi,
    (whole, name: string) => (added.has(name.toLowerCase()) ? "" : whole),
  );
  return !/\bdrop\b/i.test(rest);
}

function classify(statement: string): string | null {
  const sql = statement.replace(/\s+/g, " ").trim();
  if (DEFINITION_ONLY_DROP.test(sql)) return null;
  if (/^drop\b/i.test(sql)) {
    return "DROP permanently removes a table, column, schema or type, and any data in it.";
  }
  if (/^truncate\b/i.test(sql)) {
    return "TRUNCATE empties a whole table.";
  }
  if (/\bdelete from\b/i.test(sql)) {
    return "DELETE FROM removes rows of data.";
  }
  if (/^alter\b/i.test(sql)) {
    if (/\bdrop\b/i.test(sql) && !dropsOnlyReplacedConstraints(sql)) {
      return "ALTER ... DROP removes a column, constraint or default that exists today.";
    }
    if (/\brename\b/i.test(sql)) {
      return "ALTER ... RENAME renames something the app or existing data may rely on.";
    }
    if (
      /\balter\s+(?:column\s+)?(?:"[^"]*"|\w+)\s+(?:set\s+data\s+)?type\b/i.test(
        sql.slice(5),
      )
    ) {
      return "ALTER COLUMN ... TYPE changes a column's type and can lose or reject existing data.";
    }
  }
  if (/^update\b/i.test(sql) && !hasTopLevelWhere(sql)) {
    return "UPDATE without WHERE changes every row in the table.";
  }
  return null;
}

export function findDestructiveStatements(
  sql: string,
  file: string,
): Finding[] {
  const stripped = stripSqlNoise(sql);
  const findings: Finding[] = [];
  let start = 0;
  while (start < stripped.length) {
    const semi = stripped.indexOf(";", start);
    const end = semi === -1 ? stripped.length : semi;
    const body = stripped.slice(start, end);
    const reason = classify(body);
    if (reason) {
      const offset = start + (body.length - body.trimStart().length);
      const line = stripped.slice(0, offset).split("\n").length;
      let statement = sql.slice(offset, end).replace(/\s+/g, " ").trim();
      if (statement.length > 160) statement = `${statement.slice(0, 157)}...`;
      findings.push({ file, line, statement, reason });
    }
    start = end + 1;
  }
  return findings;
}

export function checkMigrations(
  changes: FileChange[],
  readFile: (path: string) => string,
): Finding[] {
  const findings: Finding[] = [];
  for (const { status, path } of changes) {
    if (!MIGRATION_PATH.test(path)) continue;
    // "A" (added) and "C" (copied) are new files; anything else touches a
    // migration that has already been merged and may already have run.
    if (status.startsWith("A") || status.startsWith("C")) {
      findings.push(...findDestructiveStatements(readFile(path), path));
    } else {
      findings.push({
        file: path,
        line: 1,
        statement: `(file ${status.startsWith("D") ? "deleted" : "edited"})`,
        reason:
          "This migration was already merged and may have run on the live database. Put the change in a new migration file instead.",
      });
    }
  }
  return findings;
}

export function formatReport(findings: Finding[], bypassed: boolean): string {
  if (findings.length === 0) return "Migration guard: no risky changes found.";
  const lines = [
    `Migration guard: ${findings.length} risky change(s) found in the database migrations.`,
    "",
  ];
  for (const f of findings) {
    lines.push(
      `${f.file} line ${f.line}: ${f.reason}`,
      `  > ${f.statement}`,
      "",
    );
  }
  lines.push(
    bypassed
      ? "Allowed because the owner approved this pull request (DATA_LOSS_APPROVED=true)."
      : "Explain this to Vicky in plain words. If she approves, add the label data-loss-approved to the pull request and re-run the check.",
  );
  return lines.join("\n");
}

export function runGuard(options: {
  changes: FileChange[];
  readFile: (path: string) => string;
  env: Record<string, string | undefined>;
}): { exitCode: number; output: string } {
  const findings = checkMigrations(options.changes, options.readFile);
  const bypassed = options.env.DATA_LOSS_APPROVED === "true";
  return {
    exitCode: findings.length > 0 && !bypassed ? 1 : 0,
    output: formatReport(findings, bypassed),
  };
}

export function parseChanges(lines: string[]): FileChange[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes("\t") ? "\t" : ":";
      const [status, ...rest] = line.split(sep);
      return { status, path: rest.join(sep) };
    });
}

function changesFromGit(): FileChange[] {
  const diff = execFileSync(
    "git",
    ["diff", "--name-status", "--no-renames", "origin/main...HEAD"],
    { encoding: "utf8" },
  );
  return parseChanges(diff.split("\n"));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const changes = args.length > 0 ? parseChanges(args) : changesFromGit();
  const { exitCode, output } = runGuard({
    changes,
    readFile: (path) => readFileSync(path, "utf8"),
    env: process.env,
  });
  console.log(output);
  process.exitCode = exitCode;
}
