import { describe, expect, it } from "vitest";
import {
  canChoosePic,
  canCreateProject,
  canEditProject,
} from "./project-access";

describe("canCreateProject", () => {
  it("lets the MD and Sales Director register for any customer", () => {
    expect(canCreateProject("md", false)).toBe(true);
    expect(canCreateProject("director", false)).toBe(true);
  });

  it("lets a salesperson register only for a customer they own", () => {
    expect(canCreateProject("sales", true)).toBe(true);
    expect(canCreateProject("bd", true)).toBe(true);
    expect(canCreateProject("sales", false)).toBe(false);
  });

  it("keeps HR & Accounts, site and purchasing read-only", () => {
    expect(canCreateProject("accounts", true)).toBe(false);
    expect(canCreateProject("site", true)).toBe(false);
    expect(canCreateProject("support", true)).toBe(false);
  });
});

describe("canEditProject", () => {
  it("lets the PIC or supporting salesperson edit", () => {
    expect(canEditProject("sales", true)).toBe(true);
    expect(canEditProject("sales", false)).toBe(false);
  });

  it("lets the MD and Sales Director edit anyone's", () => {
    expect(canEditProject("md", false)).toBe(true);
    expect(canEditProject("director", false)).toBe(true);
  });

  it("keeps HR & Accounts read-only even on a project they appear on", () => {
    expect(canEditProject("accounts", true)).toBe(false);
  });
});

describe("canChoosePic", () => {
  it("is the MD and Sales Director only", () => {
    expect(canChoosePic("md")).toBe(true);
    expect(canChoosePic("director")).toBe(true);
    expect(canChoosePic("sales")).toBe(false);
    expect(canChoosePic("bd")).toBe(false);
  });
});
