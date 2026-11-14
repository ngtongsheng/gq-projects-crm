import { describe, expect, it } from "vitest";
import { DEV_PROJECT_REF, PROD_PROJECT_REF } from "../supabase/test-copy";
import {
  isDevSignInAllowed,
  isTestSignInEmail,
  testSignInEmail,
} from "./dev-sign-in";

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

describe("test sign-in emails", () => {
  it("are on the unusable domain and recognised as test people", () => {
    expect(testSignInEmail("eddie")).toBe("test-eddie@example.invalid");
    expect(isTestSignInEmail(testSignInEmail("waimun"))).toBe(true);
    expect(isTestSignInEmail("vicky@gqprojects.com.my")).toBe(false);
    expect(isTestSignInEmail(undefined)).toBe(false);
  });
});
