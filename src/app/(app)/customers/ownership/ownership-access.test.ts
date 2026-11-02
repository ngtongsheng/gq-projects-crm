import { describe, expect, it } from "vitest";
import {
  canDecideOwnership,
  canOpenOwnershipRequests,
  canRequestOwnership,
} from "./ownership-access";

describe("ownership access", () => {
  it("lets salespeople ask for customers they do not own", () => {
    expect(canRequestOwnership("sales", false)).toBe(true);
    expect(canRequestOwnership("bd", false)).toBe(true);
  });

  it("does not let owners, managers or read-only roles ask", () => {
    expect(canRequestOwnership("sales", true)).toBe(false);
    expect(canRequestOwnership("md", false)).toBe(false);
    expect(canRequestOwnership("director", false)).toBe(false);
    expect(canRequestOwnership("accounts", false)).toBe(false);
  });

  it("lets only the MD and Sales Director decide", () => {
    expect(canDecideOwnership("md")).toBe(true);
    expect(canDecideOwnership("director")).toBe(true);
    expect(canDecideOwnership("sales")).toBe(false);
    expect(canDecideOwnership("bd")).toBe(false);
    expect(canDecideOwnership("accounts")).toBe(false);
  });

  it("shows the requests page to deciders and salespeople", () => {
    expect(canOpenOwnershipRequests("md")).toBe(true);
    expect(canOpenOwnershipRequests("sales")).toBe(true);
    expect(canOpenOwnershipRequests("accounts")).toBe(false);
    expect(canOpenOwnershipRequests("site")).toBe(false);
  });
});
