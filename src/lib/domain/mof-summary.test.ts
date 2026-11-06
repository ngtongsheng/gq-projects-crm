import { describe, expect, it } from "vitest";
import { daysOutstanding, marginOf, receivedPct } from "./mof-summary";

describe("marginOf", () => {
  it("works out margin and margin % from invoice and cost", () => {
    expect(marginOf(7720.9, 4393.39)).toEqual({
      margin: 3327.51,
      marginPct: 43.1,
    });
  });

  it("shows a loss as a negative margin", () => {
    expect(marginOf(1000, 1200)).toEqual({ margin: -200, marginPct: -20 });
  });

  it("has no margin % before there is an invoice", () => {
    expect(marginOf(0, 500)).toEqual({ margin: -500, marginPct: null });
  });
});

describe("receivedPct", () => {
  it("is the share received, to 0.1", () => {
    expect(receivedPct(10000, 2500)).toBe(25);
    expect(receivedPct(3, 1)).toBe(33.3);
  });

  it("never goes above 100 and has none without an invoice", () => {
    expect(receivedPct(1000, 1200)).toBe(100);
    expect(receivedPct(0, 0)).toBeNull();
  });
});

describe("daysOutstanding", () => {
  it("counts days since the invoice while money is owed", () => {
    expect(daysOutstanding("2026-10-01", 500, "2026-11-05")).toBe(35);
  });

  it("is blank when nothing is owed or there is no invoice date", () => {
    expect(daysOutstanding("2026-10-01", 0, "2026-11-05")).toBeNull();
    expect(daysOutstanding(null, 500, "2026-11-05")).toBeNull();
  });

  it("is never negative for an invoice dated in the future", () => {
    expect(daysOutstanding("2026-11-10", 500, "2026-11-05")).toBe(0);
  });
});
