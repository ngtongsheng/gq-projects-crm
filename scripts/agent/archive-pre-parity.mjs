// Loop 22 task 04 (D6): local drafts made before the parity rewrite are kept as tags on origin and taken out of the
// way, so ship-queue never has to rebase them. A branch is pre-parity when it is not in origin/main and does not
// contain the cut-off commit. Nothing is removed before its tag is on origin. Node standard library only.
import { execFileSync } from "node:child_process";
import path from "node:path";

export const PARITY_CUTOFF = "3328d4e";
const TAG_PREFIX = "archive/pre-parity/";
const SAVE_MESSAGE = "chore: save draft before archive";
export const ARCHIVED_LINE =
  "Your older drafts from before the new app are saved; ask me if you want something from them.";

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function gitSucceeds(cwd, args) {
  try {
    git(cwd, args);
    return true;
  } catch {
    return false;
  }
}

/**
 * Folder and branch of every worktree.
 * @param {string} output `git worktree list --porcelain`
 * @returns {{ folder: string, branch: string | null }[]}
 */
export function parseWorktrees(output) {
  return output
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/))
    .filter((lines) => lines[0]?.startsWith("worktree "))
    .map((lines) => ({
      folder: (lines[0] ?? "").slice("worktree ".length),
      branch:
        lines
          .find((line) => line.startsWith("branch refs/heads/"))
          ?.slice("branch refs/heads/".length) ?? null,
    }));
}

/**
 * Local branches to archive: not in origin/main, without the cut-off commit.
 * @param {string} cwd
 * @param {string} cutoff
 */
function preParityBranches(cwd, cutoff) {
  return git(cwd, ["for-each-ref", "--format=%(refname:short)", "refs/heads"])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(
      (branch) =>
        branch !== "main" &&
        !branch.startsWith("archive/") &&
        !gitSucceeds(cwd, [
          "merge-base",
          "--is-ancestor",
          branch,
          "origin/main",
        ]) &&
        !gitSucceeds(cwd, ["merge-base", "--is-ancestor", cutoff, branch]),
    );
}

/** Commits only when the worktree has changes. @param {string} folder */
function saveDraft(folder) {
  if (git(folder, ["status", "--porcelain"]) === "") return;
  git(folder, ["add", "-A"]);
  const identity = gitSucceeds(folder, ["config", "user.email"])
    ? []
    : ["-c", "user.name=GQP Office", "-c", "user.email=noreply@invalid"];
  git(folder, [...identity, "commit", "--no-verify", "-m", SAVE_MESSAGE]);
}

/**
 * Tag name for the branch; a name already used by another commit gets the short hash so no tag is overwritten.
 * @param {string} cwd
 * @param {string} branch
 */
function tagFor(cwd, branch) {
  const tag = `${TAG_PREFIX}${branch}`;
  const tip = git(cwd, ["rev-parse", `refs/heads/${branch}`]);
  const existing = gitSucceeds(cwd, [
    "rev-parse",
    "--verify",
    `refs/tags/${tag}`,
  ])
    ? git(cwd, ["rev-parse", `refs/tags/${tag}^{commit}`])
    : null;
  return existing === null || existing === tip
    ? tag
    : `${tag}-${tip.slice(0, 7)}`;
}

/**
 * Archives every pre-parity local branch. Returns what was archived, or null when there was nothing to do.
 * Branches checked out in the main folder or in `cwd` are left alone (they cannot be removed from under their owner).
 * @param {string} cwd
 * @param {string} [cutoff] the parity cut-off commit; a parameter so tests can use their own history
 * @returns {Promise<{ ok: boolean, label: string } | null>}
 */
export async function archivePreParity(cwd, cutoff = PARITY_CUTOFF) {
  if (
    !gitSucceeds(cwd, ["rev-parse", "--verify", "--quiet", "origin/main"]) ||
    !gitSucceeds(cwd, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${cutoff}^{commit}`,
    ])
  ) {
    return null;
  }
  const top = path.resolve(git(cwd, ["rev-parse", "--show-toplevel"]));
  const worktrees = parseWorktrees(
    git(cwd, ["worktree", "list", "--porcelain"]),
  );
  const mainFolder = path.resolve(worktrees[0]?.folder ?? top);

  let archived = 0;
  const stuck = [];
  for (const branch of preParityBranches(cwd, cutoff)) {
    const worktree = worktrees.find((entry) => entry.branch === branch);
    const folder = worktree ? path.resolve(worktree.folder) : null;
    if (folder === top || folder === mainFolder) continue;
    try {
      if (folder) saveDraft(folder);
      const tag = tagFor(cwd, branch);
      git(cwd, ["tag", "--force", tag, `refs/heads/${branch}`]);
      git(cwd, ["push", "origin", `refs/tags/${tag}`]);
      if (folder) git(cwd, ["worktree", "remove", folder]);
      git(cwd, ["branch", "-D", branch]);
      archived += 1;
    } catch {
      stuck.push(branch);
    }
  }
  if (stuck.length > 0) {
    return {
      ok: false,
      label: "save your older drafts from before the new app",
    };
  }
  return archived > 0 ? { ok: true, label: ARCHIVED_LINE } : null;
}
