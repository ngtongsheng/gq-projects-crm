import { describe, expect, it } from "vitest";
import {
  canAddContact,
  canEditContact,
  canSetAccountType,
} from "./contact-access";

describe("contact access", () => {
  it("lets everyone but HR & Accounts add", () => {
    expect(canAddContact("sales")).toBe(true);
    expect(canAddContact("bd")).toBe(true);
    expect(canAddContact("accounts")).toBe(false);
  });

  it("lets owners and the MD or Sales Director edit", () => {
    expect(canEditContact("sales", true)).toBe(true);
    expect(canEditContact("md", false)).toBe(true);
    expect(canEditContact("director", false)).toBe(true);
  });

  it("keeps everyone else out", () => {
    expect(canEditContact("sales", false)).toBe(false);
    expect(canEditContact("bd", false)).toBe(false);
    expect(canEditContact("accounts", false)).toBe(false);
  });

  it("limits account type to the MD and Sales Director", () => {
    expect(canSetAccountType("md")).toBe(true);
    expect(canSetAccountType("director")).toBe(true);
    expect(canSetAccountType("sales")).toBe(false);
  });
});
