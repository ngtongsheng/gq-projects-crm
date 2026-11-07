import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  DEV_PROJECT_REF,
  PROD_PROJECT_REF,
} from "../example-data/seed-guard.ts";

// Runs the real scripts with a minimal environment. Each must exit on the guard, before any connection.
function run(script: string, env: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
    timeout: 15_000,
  });
}

describe("db-test-copy", () => {
  it("exits non-zero for the live app without echoing the string", () => {
    const result = run("scripts/db-test-copy.ts", {
      SUPABASE_DEV_DB_URL: `postgresql://postgres.${PROD_PROJECT_REF}:hunter2@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("live app");
    expect(result.stderr).not.toContain("hunter2");
  });

  it("exits non-zero when no database is set up", () => {
    const result = run("scripts/db-test-copy.ts", {});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("connect-test-copy");
  });
});

describe.each([
  "scripts/reset-test-sign-ins.ts",
  "scripts/connect-test-copy.ts",
])("%s", (script) => {
  it("refuses the live app before using any key", () => {
    const result = run(script, {
      NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_PROJECT_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_unused",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("live app");
  });

  it("is happy to start on the test copy (stops only for the missing key)", () => {
    const result = run(script, {
      NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_PROJECT_REF}.supabase.co`,
    });
    expect(result.stderr).not.toContain("Refusing");
  });
});
