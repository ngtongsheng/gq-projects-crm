// Frees the port the CRM preview needs (sign-in only works on 3000), on Windows and Mac.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 3000;
const LOCK_FILE = ".next/dev/lock";

/**
 * Pids listening on `port` in `netstat -ano` output. A listening row has a
 * foreign address ending in ":0", which holds on non-English Windows too
 * (the state word is translated there).
 * @param {string} output
 * @param {number} port
 * @returns {number[]}
 */
export function parseNetstatListeners(output, port) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const [proto, local, foreign, ...rest] = line.trim().split(/\s+/);
    if (proto?.toUpperCase() !== "TCP" || !local || !foreign) continue;
    if (!local.endsWith(`:${port}`) || !foreign.endsWith(":0")) continue;
    const pid = Number(rest.at(-1));
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

/** @param {string} contents */
export function parseLockPid(contents) {
  try {
    const parsed = JSON.parse(contents);
    return Number.isInteger(parsed?.pid) && parsed.pid > 0 ? parsed.pid : null;
  } catch {
    return null;
  }
}

/** @param {number} port */
function findListeners(port) {
  if (process.platform === "win32") {
    return parseNetstatListeners(
      execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" }),
      port,
    );
  }
  try {
    return execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    })
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
  } catch {
    // lsof exits 1 when nothing listens on the port.
    return [];
  }
}

/** @param {number} pid */
function kill(pid) {
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/F", "/T"], {
        stdio: "ignore",
      });
    } else {
      process.kill(pid);
    }
    console.log(`Stopped the old preview (process ${pid}).`);
  } catch {
    console.log(`Process ${pid} was already gone.`);
  }
}

function main() {
  const port = Number(process.argv[2] ?? DEFAULT_PORT);
  const pids = new Set(findListeners(port));
  if (existsSync(LOCK_FILE)) {
    const lockPid = parseLockPid(readFileSync(LOCK_FILE, "utf8"));
    if (lockPid) pids.add(lockPid);
  }
  pids.delete(process.pid);
  if (pids.size === 0) {
    console.log(`Port ${port} is already free.`);
    return;
  }
  for (const pid of pids) kill(pid);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
