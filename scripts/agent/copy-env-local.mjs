// New worktrees lack .env.local (gitignored), so the test copy's secrets are missing there. Copies it from
// the main checkout, the first entry of `git worktree list`, when this folder has none.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ENV_FILE = ".env.local";

/**
 * The main checkout's folder in `git worktree list --porcelain` output.
 * @param {string} output
 * @returns {string | null}
 */
export function mainCheckoutFromWorktreeList(output) {
  const first = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("worktree "));
  return first ? first.slice("worktree ".length) : null;
}

/**
 * Copies .env.local into `folder` from the main checkout when `folder` has none.
 * @param {string} folder
 * @param {string} mainCheckout
 * @returns {"present" | "copied" | "missing"}
 */
export function copyEnvLocal(folder, mainCheckout) {
  const target = join(folder, ENV_FILE);
  if (existsSync(target)) return "present";
  const source = join(mainCheckout, ENV_FILE);
  if (!existsSync(source)) return "missing";
  copyFileSync(source, target);
  return "copied";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const main = mainCheckoutFromWorktreeList(
    execFileSync("git", ["worktree", "list", "--porcelain"], {
      encoding: "utf8",
    }),
  );
  const outcome = main ? copyEnvLocal(process.cwd(), main) : "missing";
  console.log(
    {
      present: "The test copy settings are already here.",
      copied: "Copied the test copy settings from the main folder.",
      missing: "No test copy settings found yet.",
    }[outcome],
  );
}
