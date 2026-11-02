import { describe, expect, it } from "vitest";
import {
  canCloseFollowUp,
  FOLLOW_UP_OWNERS,
  isFollowUpOverdue,
} from "./site-log";

describe("canCloseFollowUp", () => {
  it("lets managers close any follow-up", () => {
    for (const role of ["md", "director", "accounts"] as const) {
      for (const owner of FOLLOW_UP_OWNERS) {
        expect(canCloseFollowUp(role, owner)).toBe(true);
      }
    }
  });

  it("lets only the owning group close its follow-up", () => {
    expect(canCloseFollowUp("sales", "salesperson")).toBe(true);
    expect(canCloseFollowUp("bd", "salesperson")).toBe(true);
    expect(canCloseFollowUp("support", "purchasing")).toBe(true);
    expect(canCloseFollowUp("site", "site_supervisor")).toBe(true);
    expect(canCloseFollowUp("sales", "purchasing")).toBe(false);
    expect(canCloseFollowUp("support", "salesperson")).toBe(false);
    expect(canCloseFollowUp("site", "salesperson")).toBe(false);
  });

  it("leaves installation team and client actions to the site supervisor", () => {
    expect(canCloseFollowUp("site", "installation_team")).toBe(true);
    expect(canCloseFollowUp("site", "client")).toBe(true);
    expect(canCloseFollowUp("sales", "client")).toBe(false);
    expect(canCloseFollowUp("support", "installation_team")).toBe(false);
  });
});

describe("isFollowUpOverdue", () => {
  const today = "2026-11-10";

  it("is overdue once an open follow-up passes its due date", () => {
    expect(isFollowUpOverdue({ dueOn: "2026-11-09", done: false }, today)).toBe(
      true,
    );
  });

  it("is not overdue on the due date, when done, or without a due date", () => {
    expect(isFollowUpOverdue({ dueOn: today, done: false }, today)).toBe(false);
    expect(isFollowUpOverdue({ dueOn: "2026-11-01", done: true }, today)).toBe(
      false,
    );
    expect(isFollowUpOverdue({ dueOn: null, done: false }, today)).toBe(false);
  });
});
