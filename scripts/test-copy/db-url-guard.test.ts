import { describe, expect, it } from "vitest";
import {
  DEV_PROJECT_REF,
  PROD_PROJECT_REF,
} from "../../src/lib/supabase/test-copy.ts";
import { assertDevDbUrl, projectRefFromDbUrl } from "./db-url-guard.ts";

const pooler = (ref: string) =>
  `postgresql://postgres.${ref}:secret-pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`;

describe("projectRefFromDbUrl", () => {
  it("reads the ref from a pooler or direct connection string", () => {
    expect(projectRefFromDbUrl(pooler("abc123"))).toBe("abc123");
    expect(
      projectRefFromDbUrl(
        "postgresql://postgres:pw@db.abc123.supabase.co:5432/postgres",
      ),
    ).toBe("abc123");
  });

  it("returns null for anything else", () => {
    expect(
      projectRefFromDbUrl("postgresql://postgres:pw@localhost:54322/postgres"),
    ).toBeNull();
    expect(projectRefFromDbUrl("https://abc123.supabase.co")).toBeNull();
    expect(projectRefFromDbUrl("not a url")).toBeNull();
    expect(
      projectRefFromDbUrl(
        "postgresql://postgres:pw@db.abc123.supabase.co.evil.test/postgres",
      ),
    ).toBeNull();
  });
});

describe("assertDevDbUrl", () => {
  it("accepts the test copy", () => {
    expect(() => assertDevDbUrl(pooler(DEV_PROJECT_REF))).not.toThrow();
  });

  it("refuses the live app without echoing the connection string", () => {
    const attempt = () => assertDevDbUrl(pooler(PROD_PROJECT_REF));
    expect(attempt).toThrow(/live app/);
    try {
      attempt();
    } catch (error) {
      expect(String(error)).not.toContain("secret-pw");
    }
  });

  it("refuses unknown and local databases", () => {
    expect(() => assertDevDbUrl(pooler("other"))).toThrow(/not the test copy/);
    expect(() =>
      assertDevDbUrl("postgresql://postgres:pw@127.0.0.1:54322/postgres"),
    ).toThrow(/not the test copy/);
  });
});
