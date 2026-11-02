import { describe, expect, it } from "vitest";
import type { CommissionLine } from "./commission-data";
import { groupByPerson, lineStatus } from "./commission-groups";

function line(overrides: {
  personId?: string;
  personName?: string;
  earned?: number;
  paidOut?: number;
  remaining?: number;
  payableNow?: number;
  ratePct?: number;
  tier?: CommissionLine["tier"];
  pctPaid?: number;
}): CommissionLine {
  return {
    personId: overrides.personId ?? "a",
    personName: overrides.personName ?? "Ann",
    tier: overrides.tier ?? "standard",
    pctPaid: overrides.pctPaid ?? 100,
    commission: {
      earned: overrides.earned ?? 0,
      ratePct: overrides.ratePct ?? 3,
    },
    balance: {
      paidOut: overrides.paidOut ?? 0,
      remaining: overrides.remaining ?? 0,
      payableNow: overrides.payableNow ?? 0,
    },
  } as unknown as CommissionLine;
}

describe("groupByPerson", () => {
  it("groups by person, sorted by name, with totals in cents", () => {
    const groups = groupByPerson([
      line({ personId: "b", personName: "Ben", earned: 0.1, remaining: 0.1 }),
      line({
        personId: "a",
        personName: "Ann",
        earned: 0.2,
        paidOut: 0.1,
        remaining: 0.1,
      }),
      line({ personId: "b", personName: "Ben", earned: 0.2, remaining: 0.2 }),
    ]);

    expect(groups.map((group) => group.personName)).toEqual(["Ann", "Ben"]);
    expect(groups[1]).toMatchObject({
      earned: 0.3,
      paidOut: 0,
      remaining: 0.3,
    });
    expect(groups[1]?.lines).toHaveLength(2);
  });
});

describe("lineStatus", () => {
  it.each([
    [{ payableNow: 100, remaining: 100 }, "Claimable"],
    [{ ratePct: 0 }, "No commission"],
    [{ paidOut: 100, remaining: 0 }, "Paid out"],
    [{ tier: "unknown", pctPaid: 95 }, "Cost missing"],
    [{ pctPaid: 40, remaining: 120 }, "40% paid"],
  ] as const)("%j reads %s", (overrides, label) => {
    expect(lineStatus(line(overrides)).label).toBe(label);
  });
});
