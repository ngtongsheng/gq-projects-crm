import { describe, expect, it } from "vitest";
import {
  actionDueState,
  byDueDate,
  inActionGroup,
  openActionCounts,
  parseActionGroup,
} from "./site-action-list";

describe("parseActionGroup", () => {
  it("accepts a known owner group", () => {
    expect(parseActionGroup("purchasing")).toBe("purchasing");
  });

  it("falls back to everyone for anything else", () => {
    expect(parseActionGroup(undefined)).toBe("all");
    expect(parseActionGroup("nobody")).toBe("all");
    expect(parseActionGroup(["client"])).toBe("all");
  });
});

describe("openActionCounts", () => {
  it("counts everyone and each owner group", () => {
    const counts = openActionCounts([
      { ownerGroup: "client" },
      { ownerGroup: "client" },
      { ownerGroup: "purchasing" },
    ]);
    expect(counts.all).toBe(3);
    expect(counts.client).toBe(2);
    expect(counts.purchasing).toBe(1);
    expect(counts.accounts).toBe(0);
  });
});

describe("inActionGroup", () => {
  it("shows every action under everyone, one group's under its own filter", () => {
    expect(inActionGroup({ ownerGroup: "client" }, "all")).toBe(true);
    expect(inActionGroup({ ownerGroup: "client" }, "client")).toBe(true);
    expect(inActionGroup({ ownerGroup: "client" }, "accounts")).toBe(false);
  });
});

describe("byDueDate", () => {
  it("puts the soonest first and undated last", () => {
    const rows = [
      { dueOn: null },
      { dueOn: "2026-11-20" },
      { dueOn: "2026-11-05" },
    ];
    expect(rows.sort(byDueDate).map((row) => row.dueOn)).toEqual([
      "2026-11-05",
      "2026-11-20",
      null,
    ]);
  });
});

describe("actionDueState", () => {
  const today = "2026-11-10";

  it("is overdue only after the due date", () => {
    expect(actionDueState({ dueOn: "2026-11-09" }, today)).toBe("overdue");
    expect(actionDueState({ dueOn: today }, today)).toBe("due");
    expect(actionDueState({ dueOn: null }, today)).toBe("no-date");
  });
});
