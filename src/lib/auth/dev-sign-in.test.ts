import { describe, expect, it } from "vitest";
import { DEV_PROJECT_REF, PROD_PROJECT_REF } from "../supabase/test-copy";
import { isDevSignInAllowed, TEST_SIGN_IN_EMAILS } from "./dev-sign-in";
import { JobRole } from "./job-role";

const TEST_COPY_URL = `https://${DEV_PROJECT_REF}.supabase.co`;

describe("isDevSignInAllowed", () => {
  it("allows pnpm dev against the test copy", () => {
    expect(
      isDevSignInAllowed({
        nodeEnv: "development",
        supabaseUrl: TEST_COPY_URL,
      }),
    ).toBe(true);
  });

  it("refuses production builds, which Vercel previews are", () => {
    expect(
      isDevSignInAllowed({ nodeEnv: "production", supabaseUrl: TEST_COPY_URL }),
    ).toBe(false);
    expect(
      isDevSignInAllowed({ nodeEnv: undefined, supabaseUrl: TEST_COPY_URL }),
    ).toBe(false);
  });

  it("refuses the live app", () => {
    expect(
      isDevSignInAllowed({
        nodeEnv: "development",
        supabaseUrl: `https://${PROD_PROJECT_REF}.supabase.co`,
      }),
    ).toBe(false);
  });

  it("refuses a missing or unknown url", () => {
    expect(
      isDevSignInAllowed({ nodeEnv: "development", supabaseUrl: undefined }),
    ).toBe(false);
    expect(
      isDevSignInAllowed({ nodeEnv: "development", supabaseUrl: "" }),
    ).toBe(false);
    expect(
      isDevSignInAllowed({
        nodeEnv: "development",
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toBe(false);
  });
});

describe("TEST_SIGN_IN_EMAILS", () => {
  it("has one distinct test email per job role", () => {
    const emails = JobRole.options.map((role) => TEST_SIGN_IN_EMAILS[role]);
    expect(new Set(emails).size).toBe(JobRole.options.length);
    for (const email of emails) expect(email).toMatch(/@example\.invalid$/);
  });
});
