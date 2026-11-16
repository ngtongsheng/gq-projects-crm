import { describe, expect, it } from "vitest";
import { planAdjustments, type ReviewLine } from "./claim-review";

const lines: ReviewLine[] = [
  { kind: "expense", id: "e1", amount: 50, originalAmount: 50 },
  { kind: "expense", id: "e2", amount: 40, originalAmount: 60 },
  { kind: "commission", id: "c1", amount: 100, originalAmount: 100 },
];

describe("planAdjustments", () => {
  it("lists only the lines whose amount changed, with the reason", () => {
    const plan = planAdjustments(
      lines,
      [
        { kind: "expense", id: "e1", amount: 30 },
        { kind: "commission", id: "c1", amount: 100 },
      ],
      " Personal shopping ",
    );
    expect(plan).toEqual({
      error: null,
      changes: [
        { kind: "expense", id: "e1", amount: 30, reason: "Personal shopping" },
      ],
    });
  });

  it("needs a reason for any change", () => {
    const plan = planAdjustments(
      lines,
      [{ kind: "expense", id: "e1", amount: 30 }],
      " ",
    );
    expect(plan.error).toMatch(/reason/);
  });

  it("drops the reason when the amount goes back to what the person claimed", () => {
    const plan = planAdjustments(
      lines,
      [{ kind: "expense", id: "e2", amount: 60 }],
      "",
    );
    expect(plan).toEqual({
      error: null,
      changes: [{ kind: "expense", id: "e2", amount: 60, reason: null }],
    });
  });

  it("ignores lines that are not in the claim and sub-sen noise", () => {
    const plan = planAdjustments(
      lines,
      [
        { kind: "expense", id: "gone", amount: 1 },
        { kind: "expense", id: "e1", amount: 50.001 },
      ],
      "",
    );
    expect(plan).toEqual({ error: null, changes: [] });
  });
});
