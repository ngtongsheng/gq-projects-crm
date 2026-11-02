import { describe, expect, it } from "vitest";
import {
  canEditActivity,
  canLogActivity,
  canMoveActivity,
} from "./activity-access";

describe("canMoveActivity", () => {
  it("lets a planned activity be completed or cancelled", () => {
    expect(canMoveActivity("planned", "completed")).toBe(true);
    expect(canMoveActivity("planned", "cancelled")).toBe(true);
  });

  it("keeps completed and cancelled final", () => {
    expect(canMoveActivity("completed", "planned")).toBe(false);
    expect(canMoveActivity("completed", "cancelled")).toBe(false);
    expect(canMoveActivity("cancelled", "planned")).toBe(false);
    expect(canMoveActivity("cancelled", "completed")).toBe(false);
  });

  it("allows saving without changing status", () => {
    expect(canMoveActivity("completed", "completed")).toBe(true);
  });
});

describe("canEditActivity", () => {
  it("lets the owner edit and others not", () => {
    expect(canEditActivity("sales", true)).toBe(true);
    expect(canEditActivity("sales", false)).toBe(false);
    expect(canEditActivity("bd", false)).toBe(false);
  });

  it("lets the MD and Sales Director edit anyone's", () => {
    expect(canEditActivity("md", false)).toBe(true);
    expect(canEditActivity("director", false)).toBe(true);
  });

  it("keeps HR & Accounts read-only", () => {
    expect(canEditActivity("accounts", true)).toBe(false);
    expect(canLogActivity("accounts")).toBe(false);
    expect(canLogActivity("sales")).toBe(true);
  });
});
