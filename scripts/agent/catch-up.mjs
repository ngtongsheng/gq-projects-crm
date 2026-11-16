// `pnpm catch-up` (loop 22, D4 and D7): brings this laptop checkout (main folder or worktree) up to date for local
// work against the test copy. Runs only the steps whose inputs changed since the last run, recorded in a stamp
// inside the git dir, prints one plain line, and prints nothing when nothing changed. Command output goes to a log
// file next to the stamp, never to the screen. Node standard library only; Mac and Windows.
import { execFile, execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  copyEnvLocal,
  mainCheckoutFromWorktreeList,
} from "./copy-env-local.mjs";
import {
  DEV_KEY_NAMES,
  fetchDevKeys,
  mergeEnvLocal,
  parseEnvText,
} from "./dev-keys.mjs";
import { OWNER } from "./session-sync.mjs";

const STAMP_FILE = "gq-catch-up.json";
const LOG_FILE = "gq-catch-up.log";
const ENV_FILE = ".env.local";
const WHATS_NEW_FILE = "docs/whats-new.md";
// Supabase rejecting the keys: the stored ones are stale, so they are fetched again once.
const AUTH_ERROR =
  /password authentication failed|invalid api key|invalid jwt|jwt expired|unauthorized/i;

/**
 * @typedef {{ ok: boolean, output: string }} RunResult
 * @typedef {{ ok: boolean, label: string }} StepResult
 * @typedef {{ id: number, inviter?: { login?: string } | null }} Invitation
 * @typedef {{
 *   run: (script: string, cwd: string) => Promise<RunResult>,
 *   isOnline: () => Promise<boolean>,
 *   listInvitations: () => Promise<unknown>,
 *   acceptInvitation: (id: number) => Promise<void>,
 *   fetchKeys: () => Record<string, string>,
 *   archive: (cwd: string) => Promise<StepResult | null>,
 * }} CatchUpDeps
 * @typedef {{ installed?: Record<string, string>, migrations?: string, seed?: string, whatsNew?: string }} Stamp
 */

/** @param {import("node:crypto").Hash} hash @param {string} dir @param {string} root */
function hashTree(hash, dir, root) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      hashTree(hash, full, root);
    } else {
      hash.update(path.relative(root, full).split(path.sep).join("/"));
      hash.update(readFileSync(full));
    }
  }
}

/**
 * Fingerprints of what each step depends on.
 * @param {string} top
 */
export function fingerprints(top) {
  const lock = createHash("sha256");
  const lockPath = path.join(top, "pnpm-lock.yaml");
  if (existsSync(lockPath)) lock.update(readFileSync(lockPath));

  const migrationsDir = path.join(top, "supabase/migrations");
  const migrations = createHash("sha256").update(
    existsSync(migrationsDir)
      ? readdirSync(migrationsDir).sort().join("\n")
      : "",
  );

  const seed = createHash("sha256");
  const exampleDir = path.join(top, "scripts/example-data");
  if (existsSync(exampleDir)) hashTree(seed, exampleDir, top);
  const seedScript = path.join(top, "scripts/seed-example-data.ts");
  if (existsSync(seedScript)) seed.update(readFileSync(seedScript));

  return {
    lock: lock.digest("hex"),
    migrations: migrations.digest("hex"),
    seed: seed.digest("hex"),
  };
}

/**
 * The version and body of docs/whats-new.md (first line `version: YYYY-MM-DD`), or null.
 * @param {string} text
 * @returns {{ version: string, body: string } | null}
 */
export function parseWhatsNew(text) {
  const [first = "", ...rest] = text.split(/\r?\n/);
  const match = /^version:\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(first);
  if (!match) return null;
  return { version: match[1], body: rest.join("\n").trim() };
}

/**
 * The one line she sees.
 * @param {string[]} done
 * @param {string[]} failed
 */
export function statusLine(done, failed) {
  if (failed.length > 0) {
    return `Your laptop is only partly up to date. I could not ${failed.join(", ")}. Claude will sort it out.`;
  }
  if (done.length > 0)
    return `Your laptop is up to date: I ${done.join(", ")}.`;
  return "Your laptop is up to date.";
}

/** @param {string} file */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** @param {string} file */
function hasDevKeys(file) {
  if (!existsSync(file)) return false;
  const env = parseEnvText(readFileSync(file, "utf8"));
  return DEV_KEY_NAMES.every((name) => Boolean(env[name]));
}

/** @param {string} cwd */
function gitDirs(cwd) {
  const [top, commonDir] = execFileSync(
    "git",
    ["rev-parse", "--show-toplevel", "--git-common-dir"],
    { cwd, encoding: "utf8" },
  )
    .trim()
    .split(/\r?\n/);
  return { top, commonDir: path.resolve(cwd, commonDir) };
}

/**
 * The last step. Loop 22 task 04 fills it in to archive work from before the rebuild; null means nothing to report.
 * @param {string} _cwd
 * @returns {Promise<StepResult | null>}
 */
export async function archivePreParity(_cwd) {
  return null;
}

/**
 * Runs every due step and reports. A failed step does not stop later ones.
 * @param {string} cwd
 * @param {CatchUpDeps} deps
 * @returns {Promise<{ output: string, ok: boolean }>}
 */
export async function catchUp(cwd, deps) {
  const { top, commonDir } = gitDirs(cwd);
  const stampPath = path.join(commonDir, STAMP_FILE);
  /** @type {Stamp} */
  const stamp = readJson(stampPath) ?? {};
  const next = { ...stamp, installed: { ...stamp.installed } };
  const current = fingerprints(top);
  const envPath = path.join(top, ENV_FILE);
  /** @type {string[]} */
  const done = [];
  /** @type {string[]} */
  const failed = [];
  /** @type {string[]} */
  const log = [];

  /** @param {string} script */
  const run = async (script) => {
    const result = await deps.run(script, top);
    log.push(
      `$ pnpm ${script} (${result.ok ? "ok" : "failed"})`,
      result.output,
    );
    return result;
  };

  // Keys: a worktree borrows the main folder's file first; the private repo is asked only when that is not enough.
  if (!existsSync(envPath)) {
    const main = mainCheckoutFromWorktreeList(
      execFileSync("git", ["worktree", "list", "--porcelain"], {
        cwd: top,
        encoding: "utf8",
      }),
    );
    if (main) copyEnvLocal(top, main);
  }
  let online = /** @type {boolean | null} */ (null);
  const refreshKeys = async () => {
    online ??= await deps.isOnline();
    if (!online) return "offline";
    try {
      await acceptOwnerInvitations(deps);
      mergeEnvLocal(envPath, deps.fetchKeys());
      log.push("Fetched the test copy keys.");
      return "fetched";
    } catch (error) {
      log.push(`Fetching the test copy keys failed: ${errorText(error)}`);
      return "failed";
    }
  };
  let keysReady = hasDevKeys(envPath);
  if (!keysReady) {
    const outcome = await refreshKeys();
    keysReady = outcome === "fetched";
    if (outcome === "failed") {
      failed.push(
        "get the test copy keys (this GitHub account has no access yet; Tong Sheng needs to send an invite)",
      );
    }
  }

  const installDue =
    next.installed[top] !== current.lock ||
    !existsSync(path.join(top, "node_modules"));
  if (installDue) {
    if ((await run("install")).ok) {
      next.installed[top] = current.lock;
      done.push("installed updates");
      // An old preview would keep running on the replaced files.
      await run("free-port");
    } else {
      failed.push("install updates");
    }
  }

  /** @param {string} script */
  const runWithKeys = async (script) => {
    const first = await run(script);
    if (first.ok || !AUTH_ERROR.test(first.output)) return first.ok;
    if ((await refreshKeys()) !== "fetched") return false;
    return (await run(script)).ok;
  };

  /** @type {[ "migrations" | "seed", string, string, string ][]} */
  const databaseSteps = [
    [
      "migrations",
      "db:test-copy",
      "brought the test copy up to date",
      "bring the test copy up to date",
    ],
    [
      "seed",
      "seed:example",
      "refreshed the example records and test sign-ins",
      "refresh the example records and test sign-ins",
    ],
  ];
  for (const [key, script, doneText, failedText] of databaseSteps) {
    if (next[key] === current[key]) continue;
    if (keysReady && (await runWithKeys(script))) {
      next[key] = current[key];
      done.push(doneText);
    } else if (keysReady || online !== false) {
      failed.push(failedText);
    }
  }

  const archived = await deps.archive(top);
  if (archived) (archived.ok ? done : failed).push(archived.label);

  const whatsNewPath = path.join(top, WHATS_NEW_FILE);
  const whatsNew = existsSync(whatsNewPath)
    ? parseWhatsNew(readFileSync(whatsNewPath, "utf8"))
    : null;
  const showWhatsNew =
    whatsNew !== null && (stamp.whatsNew ?? "") < whatsNew.version;
  if (showWhatsNew) next.whatsNew = whatsNew.version;

  if (JSON.stringify(next) !== JSON.stringify(stamp)) {
    writeFileSync(stampPath, `${JSON.stringify(next, null, 2)}\n`);
  }
  if (log.length > 0) {
    writeFileSync(
      path.join(commonDir, LOG_FILE),
      `${redact(log.join("\n"), envPath)}\n`,
      { mode: 0o600 },
    );
  }
  if (done.length === 0 && failed.length === 0 && !showWhatsNew) {
    return { output: "", ok: true };
  }
  const lines = [statusLine(done, failed)];
  if (showWhatsNew && whatsNew) lines.push("", "What's new:", whatsNew.body);
  return { output: lines.join("\n"), ok: failed.length === 0 };
}

/** @param {CatchUpDeps} deps */
async function acceptOwnerInvitations(deps) {
  const invitations = await deps.listInvitations();
  if (!Array.isArray(invitations)) return;
  for (const invitation of /** @type {Invitation[]} */ (invitations)) {
    if (
      Number.isInteger(invitation?.id) &&
      invitation.inviter?.login === OWNER
    ) {
      await deps.acceptInvitation(invitation.id);
    }
  }
}

/** @param {unknown} error */
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Hides the key values in text bound for the log file.
 * @param {string} text
 * @param {string} envPath
 */
function redact(text, envPath) {
  if (!existsSync(envPath)) return text;
  const env = parseEnvText(readFileSync(envPath, "utf8"));
  return DEV_KEY_NAMES.reduce(
    (out, name) => (env[name] ? out.split(env[name]).join("[hidden]") : out),
    text,
  );
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<string>}
 */
function gh(command, args) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: 15_000, windowsHide: true, encoding: "utf8" },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
}

/** @type {CatchUpDeps} */
const realDeps = {
  run: (script, cwd) =>
    new Promise((resolve) => {
      const child = spawn("pnpm", [script], {
        cwd,
        shell: process.platform === "win32",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      child.on("error", (error) =>
        resolve({ ok: false, output: `${output}${error.message}` }),
      );
      child.on("close", (code) => resolve({ ok: code === 0, output }));
    }),
  isOnline: () =>
    lookup("api.github.com").then(
      () => true,
      () => false,
    ),
  listInvitations: async () =>
    JSON.parse(await gh("gh", ["api", "user/repository_invitations"])),
  acceptInvitation: async (id) => {
    await gh("gh", ["api", "-X", "PATCH", `user/repository_invitations/${id}`]);
  },
  fetchKeys: fetchDevKeys,
  archive: archivePreParity,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  catchUp(process.cwd(), realDeps).then(
    ({ output, ok }) => {
      if (output) process.stdout.write(`${output}\n`);
      if (!ok) process.exitCode = 1;
    },
    (error) => {
      process.stdout.write(
        "I could not check whether your laptop is up to date. Claude will sort it out.\n",
      );
      process.stderr.write(`${errorText(error)}\n`);
      process.exitCode = 1;
    },
  );
}
