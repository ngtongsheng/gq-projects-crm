import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  copyEnvLocal,
  mainCheckoutFromWorktreeList,
} from "./copy-env-local.mjs";

describe("mainCheckoutFromWorktreeList", () => {
  it("is the first worktree listed", () => {
    const output =
      "worktree /work/crm\nHEAD abc\nbranch refs/heads/main\n\nworktree /work/crm/.claude/worktrees/x\nHEAD def\n";
    expect(mainCheckoutFromWorktreeList(output)).toBe("/work/crm");
  });

  it("handles Windows line endings and empty output", () => {
    expect(
      mainCheckoutFromWorktreeList("worktree C:/crm\r\nHEAD abc\r\n"),
    ).toBe("C:/crm");
    expect(mainCheckoutFromWorktreeList("")).toBeNull();
  });
});

describe("copyEnvLocal", () => {
  function folders() {
    const root = mkdtempSync(join(tmpdir(), "copy-env-"));
    const main = join(root, "main");
    const worktree = join(root, "worktree");
    mkdirSync(main);
    mkdirSync(worktree);
    return { main, worktree };
  }

  it("copies from the main checkout when the worktree has none", () => {
    const { main, worktree } = folders();
    writeFileSync(join(main, ".env.local"), "A=1\n");
    expect(copyEnvLocal(worktree, main)).toBe("copied");
    expect(readFileSync(join(worktree, ".env.local"), "utf8")).toBe("A=1\n");
  });

  it("keeps the worktree's own file", () => {
    const { main, worktree } = folders();
    writeFileSync(join(main, ".env.local"), "A=1\n");
    writeFileSync(join(worktree, ".env.local"), "A=2\n");
    expect(copyEnvLocal(worktree, main)).toBe("present");
    expect(readFileSync(join(worktree, ".env.local"), "utf8")).toBe("A=2\n");
  });

  it("reports missing when the main checkout has none either", () => {
    const { main, worktree } = folders();
    expect(copyEnvLocal(worktree, main)).toBe("missing");
  });
});
