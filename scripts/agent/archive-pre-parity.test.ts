import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARCHIVED_LINE,
  archivePreParity,
  parseWorktrees,
} from "./archive-pre-parity.mjs";

const IDENTITY = ["-c", "user.name=Test", "-c", "user.email=t@example.com"];

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commit(cwd: string, message: string) {
  writeFileSync(join(cwd, `${message.replace(/\W+/g, "-")}.txt`), message);
  git(cwd, "add", "-A");
  git(cwd, ...IDENTITY, "commit", "--quiet", "-m", message);
}

/** An unmerged draft started before the cut-off, left checked out nowhere. */
function oldDraft(main: string, oldWork: string, branch: string) {
  git(main, "checkout", "--quiet", "-b", branch, oldWork);
  commit(main, `draft on ${branch}`);
  git(main, "checkout", "--quiet", "main");
}

/**
 * A bare origin plus a clone whose history is: old work, then the cut-off commit (tagged to find it later), then more
 * main commits. Returns paths realpath'd so macOS /var and /private/var compare equal.
 */
function laptop() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "archive-")));
  const origin = join(root, "origin.git");
  const main = join(root, "main");
  git(root, "init", "--quiet", "--bare", "-b", "main", origin);
  git(root, "clone", "--quiet", origin, main);
  commit(main, "old work");
  const oldWork = git(main, "rev-parse", "HEAD");
  commit(main, "parity cut-off");
  const cutoff = git(main, "rev-parse", "HEAD");
  commit(main, "after parity");
  git(main, "push", "--quiet", "origin", "HEAD:main");
  return { root, origin, main, oldWork, cutoff };
}

beforeEach(() => {
  vi.stubEnv("HOME", mkdtempSync(join(tmpdir(), "archive-home-")));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseWorktrees", () => {
  it("reads folder and branch, null for a detached head", () => {
    const output =
      "worktree /a\nHEAD 1\nbranch refs/heads/main\n\nworktree /b\nHEAD 2\ndetached\n";
    expect(parseWorktrees(output)).toEqual([
      { folder: "/a", branch: "main" },
      { folder: "/b", branch: null },
    ]);
  });
});

describe("archivePreParity", () => {
  it("tags, saves, and removes a pre-parity branch with a dirty worktree", async () => {
    const { root, origin, main, oldWork, cutoff } = laptop();
    oldDraft(main, oldWork, "feat/old");
    const draft = join(root, "old-draft");
    git(main, "worktree", "add", "--quiet", draft, "feat/old");
    writeFileSync(join(draft, "notes.txt"), "unsaved\n");

    const result = await archivePreParity(main, cutoff);

    expect(result).toEqual({ ok: true, label: ARCHIVED_LINE });
    expect(existsSync(draft)).toBe(false);
    expect(git(main, "branch", "--list", "feat/old")).toBe("");
    const tag = "archive/pre-parity/feat/old";
    expect(git(origin, "tag", "--list", tag)).toBe(tag);
    expect(git(origin, "log", "-1", "--format=%s", tag)).toBe(
      "chore: save draft before archive",
    );
    expect(git(origin, "show", `${tag}:notes.txt`)).toBe("unsaved");
    expect(git(origin, "branch", "--list")).toContain("main");
  });

  it("leaves post-parity and merged branches alone", async () => {
    const { main, cutoff } = laptop();
    git(main, "checkout", "--quiet", "-b", "feat/new", cutoff);
    commit(main, "built after the cut-off");
    git(main, "checkout", "--quiet", "main");
    git(main, "branch", "feat/merged", "main");

    expect(await archivePreParity(main, cutoff)).toBeNull();
    const branches = git(main, "branch", "--format=%(refname:short)");
    expect(branches).toContain("feat/new");
    expect(branches).toContain("feat/merged");
  });

  it("skips a branch checked out in the folder it runs from", async () => {
    const { main, oldWork, cutoff } = laptop();
    oldDraft(main, oldWork, "feat/old");
    git(main, "checkout", "--quiet", "feat/old");
    expect(await archivePreParity(main, cutoff)).toBeNull();
    expect(git(main, "branch", "--show-current")).toBe("feat/old");
  });

  it("is a no-op the second time", async () => {
    const { main, oldWork, cutoff } = laptop();
    oldDraft(main, oldWork, "feat/old");
    expect((await archivePreParity(main, cutoff))?.ok).toBe(true);
    expect(await archivePreParity(main, cutoff)).toBeNull();
  });

  it("keeps the branch and reports a failure when the tag cannot reach origin", async () => {
    const { main, oldWork, cutoff } = laptop();
    oldDraft(main, oldWork, "feat/old");
    git(main, "remote", "set-url", "origin", join(main, "nowhere.git"));
    git(main, "update-ref", "refs/remotes/origin/main", "main");

    const result = await archivePreParity(main, cutoff);

    expect(result?.ok).toBe(false);
    expect(git(main, "branch", "--list", "feat/old")).toContain("feat/old");
  });

  it("does nothing without origin/main or the cut-off commit", async () => {
    const { main } = laptop();
    expect(await archivePreParity(main, "0".repeat(40))).toBeNull();
  });
});
