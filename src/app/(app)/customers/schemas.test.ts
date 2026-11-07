import { describe, expect, it } from "vitest";
import {
  companyFormSchema,
  companyRatingSchema,
  contactFormSchema,
} from "./schemas";

const COMPANY_ID = "33333333-3333-4333-8333-333333333333";
const PASSER_ID = "44444444-4444-4444-8444-444444444444";

const contact = (overrides: Record<string, string> = {}) => ({
  companyId: COMPANY_ID,
  name: " Aisha Rahman ",
  mobile: "012-345 6789",
  title: "",
  accountType: "own",
  passedBy: "",
  notes: "",
  ...overrides,
});

const company = (overrides: Record<string, string> = {}) => ({
  name: "Lumen Interior Studio",
  companyType: "designer",
  rating: "3",
  accountType: "",
  passedBy: "",
  address: "",
  notes: "",
  ...overrides,
});

describe("contactFormSchema", () => {
  it("normalises the mobile and blanks", () => {
    expect(contactFormSchema.parse(contact())).toEqual({
      companyId: COMPANY_ID,
      name: "Aisha Rahman",
      mobile: "60123456789",
      title: null,
      accountType: "own",
      passedBy: null,
      notes: null,
    });
  });

  it("rejects a bad mobile", () => {
    expect(
      contactFormSchema.safeParse(contact({ mobile: "12345" })).success,
    ).toBe(false);
  });

  it.each([
    "0",
    "6",
    "3.5",
    "",
    "abc",
  ])("rejects company rating %j", (rating) => {
    expect(companyRatingSchema.safeParse(rating).success).toBe(false);
  });

  it.each(["", "pass", "staff"])("rejects account type %j", (accountType) => {
    expect(contactFormSchema.safeParse(contact({ accountType })).success).toBe(
      false,
    );
  });

  it("needs passed-by exactly when the account is pass-down", () => {
    expect(
      contactFormSchema.safeParse(contact({ accountType: "pass_down" }))
        .success,
    ).toBe(false);
    expect(
      contactFormSchema.safeParse(contact({ passedBy: PASSER_ID })).success,
    ).toBe(false);
    expect(
      contactFormSchema.parse(
        contact({ accountType: "pass_down", passedBy: PASSER_ID }),
      ).passedBy,
    ).toBe(PASSER_ID);
  });
});

describe("companyFormSchema", () => {
  it("treats a blank account type as not fixed", () => {
    expect(companyFormSchema.parse(company()).accountType).toBeNull();
  });

  it("rejects an unknown company type and a bad rating", () => {
    expect(
      companyFormSchema.safeParse(company({ companyType: "shop" })).success,
    ).toBe(false);
    expect(companyFormSchema.safeParse(company({ rating: "9" })).success).toBe(
      false,
    );
  });

  it("needs passed-by for a pass-down company", () => {
    expect(
      companyFormSchema.safeParse(company({ accountType: "pass_down" }))
        .success,
    ).toBe(false);
  });
});
