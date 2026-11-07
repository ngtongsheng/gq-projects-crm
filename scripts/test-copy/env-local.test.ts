import { describe, expect, it } from "vitest";
import { DEV_PROJECT_REF } from "../example-data/seed-guard.ts";
import { projectRefFromDbUrl } from "./db-url-guard.ts";
import { buildDevDbUrl, mergeEnv, parseTestCopyPaste } from "./env-local.ts";

describe("parseTestCopyPaste", () => {
  it("finds the key and the password in either order", () => {
    const expected = { secretKey: "sb_secret_abc", dbPassword: "pw-123" };
    expect(parseTestCopyPaste("sb_secret_abc\npw-123\n")).toEqual(expected);
    expect(parseTestCopyPaste("  pw-123   sb_secret_abc ")).toEqual(expected);
  });

  it("accepts a legacy JWT key and NAME=value or quoted forms", () => {
    expect(
      parseTestCopyPaste('SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi.x.y\n"pw-123"'),
    ).toEqual({ secretKey: "eyJhbGciOi.x.y", dbPassword: "pw-123" });
  });

  it("refuses anything but one key and one password, without echoing values", () => {
    for (const text of ["", "only-one", "sb_secret_a sb_secret_b", "a b"]) {
      expect(() => parseTestCopyPaste(text)).toThrow(/Expected two values/);
    }
    try {
      parseTestCopyPaste("sb_secret_leaky a b");
    } catch (error) {
      expect(String(error)).not.toContain("leaky");
    }
  });
});

describe("buildDevDbUrl", () => {
  it("points at the test copy and encodes awkward passwords", () => {
    const url = buildDevDbUrl("p@ss:w/rd#1");
    expect(projectRefFromDbUrl(url)).toBe(DEV_PROJECT_REF);
    expect(new URL(url).password).toBe(encodeURIComponent("p@ss:w/rd#1"));
    expect(decodeURIComponent(new URL(url).password)).toBe("p@ss:w/rd#1");
  });
});

describe("mergeEnv", () => {
  it("adds missing variables and keeps other lines", () => {
    expect(mergeEnv("OTHER=1\n", { A: "x", B: "y" })).toBe(
      "OTHER=1\nA=x\nB=y\n",
    );
    expect(mergeEnv("", { A: "x" })).toBe("A=x\n");
  });

  it("replaces a variable that is already set", () => {
    expect(mergeEnv("A=old\nOTHER=1\n", { A: "new" })).toBe("A=new\nOTHER=1\n");
  });
});
