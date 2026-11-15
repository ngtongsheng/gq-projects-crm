import { describe, expect, it } from "vitest";
import {
  canAddContact,
  canAddPersonToCompany,
  canEditCompany,
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

  it("limits adding a person to a company to its salespeople and the MD or Sales Director", () => {
    expect(canAddPersonToCompany("sales", ["arun"], "mei")).toBe(false);
    expect(canAddPersonToCompany("sales", ["arun", "mei"], "mei")).toBe(true);
    expect(canAddPersonToCompany("md", ["arun"], "mei")).toBe(true);
    expect(canAddPersonToCompany("director", ["arun"], "mei")).toBe(true);
    expect(canAddPersonToCompany("accounts", ["mei"], "mei")).toBe(false);
  });

  it("lets anyone who may add start a company nobody owns yet", () => {
    expect(canAddPersonToCompany("sales", [], "mei")).toBe(true);
  });

  it("limits editing a company to the MD and Sales Director", () => {
    expect(canEditCompany("md")).toBe(true);
    expect(canEditCompany("director")).toBe(true);
    expect(canEditCompany("sales")).toBe(false);
  });
});
