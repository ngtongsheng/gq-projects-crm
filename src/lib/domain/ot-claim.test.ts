import { describe, expect, it } from "vitest";
import { decisionColumns, otTotals } from "./ot-claim";

describe("decisionColumns", () => {
  it("approves as the chosen type", () => {
    expect(decisionColumns("replacement_leave")).toEqual({
      status: "approved",
      approved_as: "replacement_leave",
    });
  });

  it("rejects without an approved type", () => {
    expect(decisionColumns("reject")).toEqual({
      status: "rejected",
      approved_as: null,
    });
  });
});

describe("otTotals", () => {
  it("splits approved hours by type and keeps pending apart", () => {
    expect(
      otTotals([
        { hours: 3, status: "approved", approvedAs: "ot" },
        { hours: 4.5, status: "approved", approvedAs: "replacement_leave" },
        { hours: 2, status: "pending", approvedAs: null },
        { hours: 1, status: "rejected", approvedAs: null },
      ]),
    ).toEqual({ ot: 3, replacementLeave: 4.5, pending: 2 });
  });
});
