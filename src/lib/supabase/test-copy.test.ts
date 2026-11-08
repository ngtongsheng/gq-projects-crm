import { describe, expect, it } from "vitest";
import {
  assertTestCopy,
  DEV_PROJECT_REF,
  PROD_PROJECT_REF,
  projectRefFromUrl,
} from "./test-copy.ts";

describe("projectRefFromUrl", () => {
  it("reads the ref from an API url", () => {
    expect(projectRefFromUrl("https://abc123.supabase.co")).toBe("abc123");
    expect(projectRefFromUrl("https://abc123.supabase.co/")).toBe("abc123");
  });

  it("returns null for anything else", () => {
    expect(projectRefFromUrl("http://localhost:54321")).toBeNull();
    expect(
      projectRefFromUrl("https://abc123.supabase.co.evil.test"),
    ).toBeNull();
    expect(projectRefFromUrl("not a url")).toBeNull();
  });
});

describe("assertTestCopy", () => {
  it("accepts the test copy", () => {
    expect(() =>
      assertTestCopy(`https://${DEV_PROJECT_REF}.supabase.co`),
    ).not.toThrow();
  });

  it("refuses the live app", () => {
    expect(() =>
      assertTestCopy(`https://${PROD_PROJECT_REF}.supabase.co`),
    ).toThrow(/live app/);
  });

  it("refuses unknown projects and local urls", () => {
    expect(() => assertTestCopy("https://other.supabase.co")).toThrow(
      /not the test copy/,
    );
    expect(() => assertTestCopy("http://127.0.0.1:54321")).toThrow(
      /not the test copy/,
    );
  });
});
