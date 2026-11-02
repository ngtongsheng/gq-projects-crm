import { describe, expect, it } from "vitest";
import { commissionBalance } from "./commission-balance";

describe("commissionBalance", () => {
  it("is earned less what was paid out", () => {
    expect(
      commissionBalance({ earned: 3_000, claimable: true }, [1_000, 0.1]),
    ).toEqual({ paidOut: 1_000.1, remaining: 1_999.9, payableNow: 1_999.9 });
  });

  it("allows nothing until the order is claimable", () => {
    expect(commissionBalance({ earned: 450, claimable: false }, [])).toEqual({
      paidOut: 0,
      remaining: 450,
      payableNow: 0,
    });
  });

  it("never goes below zero when a late cut leaves a person overpaid", () => {
    expect(
      commissionBalance({ earned: 900, claimable: true }, [1_000]),
    ).toEqual({ paidOut: 1_000, remaining: 0, payableNow: 0 });
  });
});
