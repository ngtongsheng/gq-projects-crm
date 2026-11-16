import { describe, expect, it } from "vitest";
import {
  decideSignIn,
  describeRefusal,
  isSignInRefusal,
  parseAllowedDomains,
} from "./sign-in-decision";

const company = ["gqprojects.com.my"];
const here = { active: true };

describe("parseAllowedDomains", () => {
  it("reads a comma-separated list, trimmed and lower-cased", () => {
    expect(
      parseAllowedDomains(" GQProjects.com.my, example.invalid ,"),
    ).toEqual(["gqprojects.com.my", "example.invalid"]);
  });

  it("is empty when the variable is missing", () => {
    expect(parseAllowedDomains(undefined)).toEqual([]);
  });
});

describe("decideSignIn", () => {
  it("lets in an active person on the company domain, any letter case", () => {
    expect(
      decideSignIn({
        email: "Mei@GQProjects.com.my",
        allowedDomains: company,
        profile: here,
      }),
    ).toBeNull();
  });

  it.each([
    "mei@gmail.com",
    "mei@gqprojects.com.my.evil.com",
    "mei@sub.gqprojects.com.my",
    "gqprojects.com.my",
    undefined,
  ])("refuses %s as off the company domain", (email) => {
    expect(
      decideSignIn({ email, allowedDomains: company, profile: here }),
    ).toBe("domain");
  });

  it("refuses everyone when no domains are configured", () => {
    expect(
      decideSignIn({
        email: "mei@gqprojects.com.my",
        allowedDomains: [],
        profile: here,
      }),
    ).toBe("domain");
  });

  it("refuses someone with no person in People", () => {
    expect(
      decideSignIn({
        email: "mei@gqprojects.com.my",
        allowedDomains: company,
        profile: null,
      }),
    ).toBe("not-added");
  });

  it("refuses someone who has left", () => {
    expect(
      decideSignIn({
        email: "mei@gqprojects.com.my",
        allowedDomains: company,
        profile: { active: false },
      }),
    ).toBe("left");
  });

  it("allows the test copy's example personas when that domain is listed", () => {
    expect(
      decideSignIn({
        email: "test-sales@example.invalid",
        allowedDomains: [...company, "example.invalid"],
        profile: here,
      }),
    ).toBeNull();
  });
});

describe("describeRefusal", () => {
  it("calls a missing ALLOWED_EMAIL_DOMAINS a configuration problem", () => {
    const line = describeRefusal({
      refusal: "domain",
      email: "mei@gqprojects.com.my",
      allowedDomains: parseAllowedDomains(undefined),
    });
    expect(line).toMatch(/ALLOWED_EMAIL_DOMAINS is missing or empty/);
    expect(line).not.toMatch(/mei/);
  });

  it("names the domain and reason but never the full email", () => {
    const line = describeRefusal({
      refusal: "domain",
      email: "Mei@Gmail.com",
      allowedDomains: company,
    });
    expect(line).toBe("Sign-in refused (domain) for email domain gmail.com");
    expect(line).not.toMatch(/mei/i);
  });

  it("copes with a missing email", () => {
    expect(
      describeRefusal({
        refusal: "domain",
        email: undefined,
        allowedDomains: company,
      }),
    ).toBe("Sign-in refused (domain) for email domain (none)");
  });
});

describe("isSignInRefusal", () => {
  it("accepts only known reasons from the URL", () => {
    expect(isSignInRefusal("left")).toBe(true);
    expect(isSignInRefusal("toString")).toBe(false);
    expect(isSignInRefusal(["left"])).toBe(false);
  });
});
