import { describe, expect, it } from "vitest";
import {
  decideSignIn,
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

describe("isSignInRefusal", () => {
  it("accepts only known reasons from the URL", () => {
    expect(isSignInRefusal("left")).toBe(true);
    expect(isSignInRefusal("toString")).toBe(false);
    expect(isSignInRefusal(["left"])).toBe(false);
  });
});
