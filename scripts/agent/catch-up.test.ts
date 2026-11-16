import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEV_PROJECT_REF } from "../../src/lib/supabase/test-copy.ts";
import { catchUp, isCatchUpDue, parseWhatsNew } from "./catch-up.mjs";

const devKeys = {
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_dev",
  SUPABASE_DEV_DB_URL: `postgresql://postgres.${DEV_PROJECT_REF}:pw@host:5432/postgres`,
};
const devKeysText = Object.entries(devKeys)
  .map(([name, value]) => `${name}=${value}`)
  .join("\n");

/** A temp git checkout shaped like the CRM: lockfile, migrations, seed files, keys, installed packages. */
function checkout() {
  const top = realpathSync(mkdtempSync(join(tmpdir(), "catch-up-")));
  execFileSync("git", ["init", "--quiet"], { cwd: top });
  mkdirSync(join(top, "supabase/migrations"), { recursive: true });
  mkdirSync(join(top, "scripts/example-data"), { recursive: true });
  mkdirSync(join(top, "node_modules"));
  mkdirSync(join(top, "docs"));
  writeFileSync(join(top, "pnpm-lock.yaml"), "lock: 1\n");
  writeFileSync(join(top, "supabase/migrations/001_start.sql"), "");
  writeFileSync(join(top, "scripts/example-data/people.ts"), "a\n");
  writeFileSync(join(top, "scripts/seed-example-data.ts"), "seed\n");
  writeFileSync(join(top, ".env.local"), `${devKeysText}\n`);
  return top;
}

type Options = {
  failing?: string[];
  online?: boolean;
  invitations?: unknown;
  outputs?: Record<string, string[]>;
};

function stubs({
  failing = [],
  online = true,
  invitations = [],
  outputs = {},
}: Options = {}) {
  const runs: string[] = [];
  const accepted: number[] = [];
  let fetches = 0;
  const deps = {
    run: async (script: string) => {
      runs.push(script);
      const output = outputs[script]?.shift() ?? "";
      return { ok: !failing.includes(script) && output === "", output };
    },
    isOnline: async () => online,
    listInvitations: async () => invitations,
    acceptInvitation: async (id: number) => {
      accepted.push(id);
    },
    fetchKeys: () => {
      fetches += 1;
      return devKeys;
    },
    archive: async () => null,
  };
  return { deps, runs, accepted, fetches: () => fetches };
}

/** Runs once so the stamp matches, then returns fresh stubs. */
async function settled(top: string, options?: Options) {
  await catchUp(top, stubs().deps);
  return stubs(options);
}

describe("catchUp", () => {
  it("does every step on the first run", async () => {
    const top = checkout();
    const { deps, runs } = stubs();
    const result = await catchUp(top, deps);
    expect(runs).toEqual([
      "install",
      "free-port",
      "db:test-copy",
      "seed:example",
    ]);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("Your laptop is up to date");
  });

  it("runs nothing and prints nothing when nothing changed", async () => {
    const top = checkout();
    const { deps, runs } = await settled(top);
    expect(await catchUp(top, deps)).toEqual({ output: "", ok: true });
    expect(runs).toEqual([]);
  });

  it("installs when the lockfile changes", async () => {
    const top = checkout();
    const { deps, runs } = await settled(top);
    writeFileSync(join(top, "pnpm-lock.yaml"), "lock: 2\n");
    await catchUp(top, deps);
    expect(runs).toEqual(["install", "free-port"]);
  });

  it("updates the test copy when a migration is added", async () => {
    const top = checkout();
    const { deps, runs } = await settled(top);
    writeFileSync(join(top, "supabase/migrations/002_more.sql"), "");
    const result = await catchUp(top, deps);
    expect(runs).toEqual(["db:test-copy"]);
    expect(result.output).toBe(
      "Your laptop is up to date: I brought the test copy up to date.",
    );
  });

  it("reseeds when an example data file changes", async () => {
    const top = checkout();
    const { deps, runs } = await settled(top);
    mkdirSync(join(top, "scripts/example-data/nested"));
    writeFileSync(join(top, "scripts/example-data/nested/x.ts"), "b\n");
    await catchUp(top, deps);
    expect(runs).toEqual(["seed:example"]);
  });

  it("fetches and merges the keys when .env.local lacks one, accepting only Tong Sheng's invites", async () => {
    const top = checkout();
    const { deps, accepted, fetches } = await settled(top, {
      invitations: [
        { id: 1, inviter: { login: "ngtongsheng" } },
        { id: 2, inviter: { login: "someone-else" } },
      ],
    });
    writeFileSync(join(top, ".env.local"), "OTHER=1\n");
    const result = await catchUp(top, deps);
    expect(fetches()).toBe(1);
    expect(accepted).toEqual([1]);
    const env = readFileSync(join(top, ".env.local"), "utf8");
    expect(env).toContain("OTHER=1");
    expect(env).toContain(`SUPABASE_DEV_DB_URL=${devKeys.SUPABASE_DEV_DB_URL}`);
    expect(result).toEqual({ output: "", ok: true });
  });

  it("names the missing keys in one line and keeps going", async () => {
    const top = checkout();
    const { deps, runs } = stubs();
    deps.fetchKeys = () => {
      throw new Error("no access");
    };
    writeFileSync(join(top, ".env.local"), "");
    const result = await catchUp(top, deps);
    expect(runs).toEqual(["install", "free-port"]);
    expect(result.ok).toBe(false);
    expect(result.output.split("\n")[0]).toMatch(
      /could not get the test copy keys, .*Claude will sort it out\.$/,
    );
  });

  it("skips the key fetch silently when offline", async () => {
    const top = checkout();
    const { deps, runs, fetches } = await settled(top, { online: false });
    writeFileSync(join(top, ".env.local"), "");
    writeFileSync(join(top, "supabase/migrations/002_more.sql"), "");
    expect(await catchUp(top, deps)).toEqual({ output: "", ok: true });
    expect(fetches()).toBe(0);
    expect(runs).toEqual([]);
  });

  it("refetches the keys once when the test copy rejects them", async () => {
    const top = checkout();
    const { deps, runs, fetches } = await settled(top, {
      outputs: { "db:test-copy": ["password authentication failed"] },
    });
    writeFileSync(join(top, "supabase/migrations/002_more.sql"), "");
    const result = await catchUp(top, deps);
    expect(fetches()).toBe(1);
    expect(runs).toEqual(["db:test-copy", "db:test-copy"]);
    expect(result.ok).toBe(true);
  });

  it("adds one line when older drafts were archived, and fails the run when archiving fails", async () => {
    const top = checkout();
    const { deps } = await settled(top);
    const archived = await catchUp(top, {
      ...deps,
      archive: async () => ({ ok: true, label: "Older drafts saved." }),
    });
    expect(archived).toEqual({
      output: "Your laptop is up to date.\nOlder drafts saved.",
      ok: true,
    });
    const stuck = await catchUp(top, {
      ...deps,
      archive: async () => ({ ok: false, label: "save older drafts" }),
    });
    expect(stuck.ok).toBe(false);
    expect(stuck.output).toContain("I could not save older drafts");
  });

  it("shows what's new once per version", async () => {
    const top = checkout();
    const { deps } = await settled(top);
    writeFileSync(
      join(top, "docs/whats-new.md"),
      "version: 2026-11-16\n# What's new\n\n- One thing\n",
    );
    const first = await catchUp(top, deps);
    expect(first.output).toBe(
      "Your laptop is up to date.\n\nWhat's new:\n# What's new\n\n- One thing",
    );
    expect(await catchUp(top, deps)).toEqual({ output: "", ok: true });
  });

  it("runs the other steps when one fails, then exits with a failure", async () => {
    const top = checkout();
    const { deps, runs } = stubs({ failing: ["install"] });
    const result = await catchUp(top, deps);
    expect(runs).toEqual(["install", "db:test-copy", "seed:example"]);
    expect(result.ok).toBe(false);
    expect(result.output).toBe(
      "Your laptop is only partly up to date. I could not install updates. Claude will sort it out.",
    );
    const retry = stubs();
    await catchUp(top, retry.deps);
    expect(retry.runs).toEqual(["install", "free-port"]);
  });
});

describe("isCatchUpDue", () => {
  it("is due before the first run and not after it", async () => {
    const top = checkout();
    expect(isCatchUpDue(top)).toBe(true);
    await catchUp(top, stubs().deps);
    expect(isCatchUpDue(top)).toBe(false);
  });

  it.each([
    ["the lockfile", "pnpm-lock.yaml", "lock: 2\n"],
    ["a new migration", "supabase/migrations/002_more.sql", ""],
    ["an example data file", "scripts/example-data/people.ts", "b\n"],
    [
      "a new what's new version",
      "docs/whats-new.md",
      "version: 2026-11-16\nHi\n",
    ],
  ])("is due again after %s changes", async (_case, file, text) => {
    const top = checkout();
    await catchUp(top, stubs().deps);
    writeFileSync(join(top, file), text);
    expect(isCatchUpDue(top)).toBe(true);
  });
});

describe("parseWhatsNew", () => {
  it("reads the version line and the body", () => {
    expect(parseWhatsNew("version: 2026-11-16\r\n\r\n- A\r\n")).toEqual({
      version: "2026-11-16",
      body: "- A",
    });
  });

  it("is null without a version line", () => {
    expect(parseWhatsNew("# What's new\n- A\n")).toBeNull();
  });
});
