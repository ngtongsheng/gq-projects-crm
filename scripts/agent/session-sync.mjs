// Session-sync hook (loop 09, D14): brings the latest main and Tong Sheng's open
// GitHub instructions into every Claude Code session. Runs on Windows and Mac,
// Node standard library only. Prints nothing when there is nothing to say or
// when git, gh or the network fail, so a hook never blocks her session.
// Usage: node session-sync.mjs [--throttle 15m]
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The trust boundary: only text written by this account becomes instructions.
export const OWNER = "ngtongsheng";
const INSTRUCTION_LABEL = "for:vicky-claude";
const REPLY_LABEL = "from:crm";
const STAMP_FILE = "agent-sync-at";

/**
 * @typedef {{ author?: { login?: string } | null, body?: string, createdAt?: string }} IssueComment
 * @typedef {{ number: number, title?: string, body?: string, author?: { login?: string } | null,
 *   labels?: { name?: string }[], comments?: IssueComment[] }} Issue
 * @typedef {{ number: number, title: string | null, text: string }} Instruction
 */

/** @param {{ login?: string } | null | undefined} author */
const isOwner = (author) => author?.login === OWNER;

/** @param {Issue} issue @param {string} label */
const hasLabel = (issue, label) =>
  (issue.labels ?? []).some((l) => l.name === label);

/**
 * Open instructions Tong Sheng wrote himself. The gh query already filters by
 * author and label; this re-checks both so the boundary does not rest on flags.
 * @param {unknown} issues
 * @returns {Instruction[]}
 */
export function selectOwnerInstructions(issues) {
  if (!Array.isArray(issues)) return [];
  return issues
    .filter(
      /** @param {Issue} i */ (i) =>
        Number.isInteger(i?.number) &&
        isOwner(i.author) &&
        hasLabel(i, INSTRUCTION_LABEL),
    )
    .map((i) => ({
      number: i.number,
      title: i.title ?? "",
      text: i.body ?? "",
    }));
}

/**
 * Open `from:crm` issues whose newest comment is Tong Sheng's. Only his
 * comment is passed on; the issue title and body come from someone else.
 * @param {unknown} issues
 * @returns {Instruction[]}
 */
export function selectOwnerReplies(issues) {
  if (!Array.isArray(issues)) return [];
  /** @type {Instruction[]} */
  const replies = [];
  for (const issue of issues) {
    if (!Number.isInteger(issue?.number) || !hasLabel(issue, REPLY_LABEL))
      continue;
    const newest = newestComment(issue.comments ?? []);
    if (newest && isOwner(newest.author)) {
      replies.push({
        number: issue.number,
        title: null,
        text: newest.body ?? "",
      });
    }
  }
  return replies;
}

/** @param {IssueComment[]} comments */
function newestComment(comments) {
  /** @type {IssueComment | undefined} */
  let newest;
  for (const c of comments) {
    const at = Date.parse(c.createdAt ?? "");
    if (Number.isNaN(at)) continue;
    if (!newest || at >= Date.parse(newest.createdAt ?? "")) newest = c;
  }
  return newest;
}

/**
 * "15m" -> 900000. Accepts s, m and h.
 * @param {string} value
 * @returns {number | null}
 */
export function parseDuration(value) {
  const match = /^(\d+)([smh])$/.exec(value.trim());
  if (!match) return null;
  const unit = { s: 1_000, m: 60_000, h: 3_600_000 }[match[2]] ?? 0;
  return Number(match[1]) * unit;
}

/**
 * True while the last sync is younger than the window. A missing, unreadable
 * or future stamp does not throttle, so a broken stamp cannot silence syncs.
 * @param {string | null} stamp
 * @param {number} now
 * @param {number} windowMs
 */
export function isThrottled(stamp, now, windowMs) {
  const last = Number(stamp);
  if (!stamp || !Number.isFinite(last) || last > now) return false;
  return now - last < windowMs;
}

/** @param {string[]} changedPaths */
export function rulesChanged(changedPaths) {
  return changedPaths.some(
    (p) => p === "CLAUDE.md" || p.startsWith(".claude/"),
  );
}

/**
 * The block the hook prints, or "" when there is nothing to act on.
 * @param {{ instructions: Instruction[], replies: Instruction[], rulesUpdated: boolean, behindBy: number }} sync
 */
export function formatSync({ instructions, replies, rulesUpdated, behindBy }) {
  const lines = [];
  if (rulesUpdated) {
    lines.push(
      "Rules updated: re-read CLAUDE.md and the skills you use before continuing.",
    );
  }
  if (behindBy > 0) {
    lines.push(
      `This change's branch is ${behindBy} commit(s) behind origin/main; the ship queue rebases it when it goes live.`,
    );
  }
  const items = [...instructions, ...replies];
  if (items.length > 0) {
    lines.push(
      "Tong Sheng's instructions (open GitHub issues; follow CLAUDE.md \"Tong Sheng's instructions\": one background subagent per issue in its own worktree, build, check, ship with deploy, comment the result and close the issue, tell Vicky one line):",
    );
    for (const item of items) {
      const heading = item.title
        ? `#${item.number} ${item.title}`
        : `#${item.number} (his reply on a from:crm issue)`;
      lines.push("", heading, item.text.trim());
    }
  }
  return lines.join("\n");
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @param {number} timeout
 * @returns {Promise<string | null>} stdout, or null on any failure
 */
function run(command, args, cwd, timeout) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { cwd, timeout, windowsHide: true, encoding: "utf8" },
      (error, stdout) => resolve(error ? null : stdout.trim()),
    );
  });
}

/** @param {string} json */
function parseJson(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** @param {string} cwd */
async function syncGit(cwd) {
  const result = { rulesUpdated: false, behindBy: 0 };
  if ((await run("git", ["fetch", "--prune", "--quiet"], cwd, 8_000)) === null)
    return result;
  const list = await run(
    "git",
    ["worktree", "list", "--porcelain"],
    cwd,
    3_000,
  );
  const mainDir = list?.match(/^worktree (.+)$/m)?.[1];
  if (!mainDir) return result;

  const branch = await run("git", ["branch", "--show-current"], mainDir, 3_000);
  const dirty = await run("git", ["status", "--porcelain"], mainDir, 5_000);
  if (branch === "main" && dirty === "") {
    const before = await run("git", ["rev-parse", "HEAD"], mainDir, 3_000);
    if (
      (await run("git", ["pull", "--ff-only", "--quiet"], mainDir, 8_000)) !==
      null
    ) {
      const changed = await run(
        "git",
        ["diff", "--name-only", `${before}..HEAD`],
        mainDir,
        3_000,
      );
      result.rulesUpdated = rulesChanged(changed ? changed.split(/\r?\n/) : []);
    }
  }

  const top = await run("git", ["rev-parse", "--show-toplevel"], cwd, 3_000);
  const here = await run("git", ["branch", "--show-current"], cwd, 3_000);
  if (
    top &&
    path.resolve(top) !== path.resolve(mainDir) &&
    here &&
    here !== "main"
  ) {
    const behind = await run(
      "git",
      ["rev-list", "--count", "HEAD..origin/main"],
      cwd,
      3_000,
    );
    result.behindBy = Number(behind) || 0;
  }
  return result;
}

/** @param {string} cwd */
async function fetchIssues(cwd) {
  // No --author flag: it routes gh through the search API, which misses issues created seconds ago.
  // The author is enforced by the filter instead.
  const [own, crm] = await Promise.all([
    run(
      "gh",
      [
        "issue",
        "list",
        "--label",
        INSTRUCTION_LABEL,
        "--state",
        "open",
        "--json",
        "number,title,body,author,labels",
      ],
      cwd,
      8_000,
    ),
    run(
      "gh",
      [
        "issue",
        "list",
        "--label",
        REPLY_LABEL,
        "--state",
        "open",
        "--json",
        "number,labels,comments",
      ],
      cwd,
      8_000,
    ),
  ]);
  if (own === null || crm === null) return null;
  return {
    instructions: selectOwnerInstructions(parseJson(own)),
    replies: selectOwnerReplies(parseJson(crm)),
  };
}

/** @param {string} cwd @param {number | null} throttleMs */
async function claimSlot(cwd, throttleMs) {
  const commonDir = await run(
    "git",
    ["rev-parse", "--git-common-dir"],
    cwd,
    3_000,
  );
  if (!commonDir) return false;
  const stampPath = path.resolve(cwd, commonDir, STAMP_FILE);
  const now = Date.now();
  if (throttleMs !== null) {
    let stamp = null;
    try {
      stamp = readFileSync(stampPath, "utf8");
    } catch {
      // No stamp yet: this is the first sync.
    }
    if (isThrottled(stamp, now, throttleMs)) return false;
  }
  writeFileSync(stampPath, String(now));
  return true;
}

async function main() {
  const cwd = process.cwd();
  const flag = process.argv.indexOf("--throttle");
  const throttleMs =
    flag === -1 ? null : parseDuration(process.argv[flag + 1] ?? "");
  if (!(await claimSlot(cwd, throttleMs))) return;
  const [git, issues] = await Promise.all([syncGit(cwd), fetchIssues(cwd)]);
  if (!issues) return;
  const output = formatSync({ ...issues, ...git });
  if (output) process.stdout.write(`${output}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  // The hook must never fail her session: any unexpected error stays silent.
  // No process.exit: stdout to a pipe is async on macOS and would be cut off.
  main().catch(() => {});
}
