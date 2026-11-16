import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEV_PROJECT_REF,
  PROD_PROJECT_REF,
} from "../../src/lib/supabase/test-copy.ts";
import { assertDevKeys, mergeEnvLocal, parseEnvText } from "./dev-keys.mjs";

const devKeys = {
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_dev",
  SUPABASE_DEV_DB_URL: `postgresql://postgres.${DEV_PROJECT_REF}:pw@host:5432/postgres`,
};

function envFile(content?: string) {
  const path = join(mkdtempSync(join(tmpdir(), "dev-keys-")), ".env.local");
  if (content !== undefined) writeFileSync(path, content);
  return path;
}

describe("parseEnvText", () => {
  it("reads values, skipping comments and blanks, and strips quotes", () => {
    const text = `# note\n\nA=1\nB="two words"\nC='x'\nD=a=b\r\n`;
    expect(parseEnvText(text)).toEqual({
      A: "1",
      B: "two words",
      C: "x",
      D: "a=b",
    });
  });
});

describe("assertDevKeys", () => {
  it("accepts the test copy's keys and returns only those two", () => {
    expect(assertDevKeys({ ...devKeys, OTHER: "x" })).toEqual(devKeys);
  });

  it("refuses a missing key without naming a value", () => {
    expect(() => assertDevKeys({})).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("refuses a database URL for the live app", () => {
    const prod = {
      ...devKeys,
      SUPABASE_DEV_DB_URL: `postgresql://postgres.${PROD_PROJECT_REF}:pw@host/postgres`,
    };
    expect(() => assertDevKeys(prod)).toThrow(/live app/);
  });

  it("refuses a database URL that is not the test copy's", () => {
    const other = { ...devKeys, SUPABASE_DEV_DB_URL: "postgresql://x:pw@h/db" };
    expect(() => assertDevKeys(other)).toThrow(/not the test copy/);
  });

  it("refuses a legacy key issued for another project", () => {
    const payload = Buffer.from(JSON.stringify({ ref: "otherref" })).toString(
      "base64url",
    );
    const other = {
      ...devKeys,
      SUPABASE_SERVICE_ROLE_KEY: `h.${payload}.s`,
    };
    expect(() => assertDevKeys(other)).toThrow(/not the test copy/);
  });
});

describe("mergeEnvLocal", () => {
  it("keeps unrelated lines and replaces changed keys", () => {
    const path = envFile("KEEP=1\nSUPABASE_SERVICE_ROLE_KEY=old\nALSO=2\n");
    mergeEnvLocal(path, devKeys);
    expect(parseEnvText(readFileSync(path, "utf8"))).toEqual({
      KEEP: "1",
      ALSO: "2",
      ...devKeys,
    });
  });

  it("creates the file when there is none, readable by the owner only", () => {
    const path = envFile();
    mergeEnvLocal(path, devKeys);
    expect(parseEnvText(readFileSync(path, "utf8"))).toEqual(devKeys);
    expect(statSync(path).mode & 0o077).toBe(0);
  });

  it("tightens the mode of an existing file", () => {
    const path = envFile("KEEP=1\n");
    mergeEnvLocal(path, devKeys);
    expect(statSync(path).mode & 0o077).toBe(0);
  });

  it("refuses a prod ref and leaves the file untouched", () => {
    const path = envFile("KEEP=1\n");
    const prod = {
      ...devKeys,
      SUPABASE_DEV_DB_URL: `postgresql://postgres.${PROD_PROJECT_REF}:pw@h/db`,
    };
    expect(() => mergeEnvLocal(path, prod)).toThrow(/live app/);
    expect(readFileSync(path, "utf8")).toBe("KEEP=1\n");
  });
});
