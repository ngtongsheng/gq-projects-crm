import { describe, expect, it } from "vitest";
import { summariseCollection } from "./collection";

describe("summariseCollection", () => {
  it("is a part payment below the threshold", () => {
    const result = summariseCollection(10_000, [2_500, 2_500], 90);
    expect(result).toMatchObject({
      received: 5_000,
      outstanding: 5_000,
      overpaid: 0,
      pctPaid: 50,
      state: "partial",
      label: "50% paid",
    });
  });

  it("opens at exactly 90%", () => {
    const result = summariseCollection(10_000, [9_000], 90);
    expect(result).toMatchObject({
      outstanding: 1_000,
      pctPaid: 90,
      state: "commission_open",
      label: "90%+",
    });
  });

  it("stays a part payment at 89.99%", () => {
    const result = summariseCollection(10_000, [8_999], 90);
    expect(result).toMatchObject({
      pctPaid: 89.9,
      state: "partial",
      label: "89.9% paid",
    });
  });

  it("adds cents without drift", () => {
    expect(summariseCollection(0.3, [0.1, 0.2], 90)).toMatchObject({
      received: 0.3,
      outstanding: 0,
      state: "fully_paid",
    });
  });

  it("follows a changed threshold, including a decimal one", () => {
    expect(summariseCollection(1_000, [750], 75).state).toBe("commission_open");
    expect(summariseCollection(1_000, [749.99], 75).state).toBe("partial");
    expect(summariseCollection(1_000, [905], 90.5).state).toBe(
      "commission_open",
    );
  });

  it("is fully paid at the invoice amount", () => {
    expect(summariseCollection(10_000, [4_000, 6_000], 90)).toMatchObject({
      outstanding: 0,
      overpaid: 0,
      pctPaid: 100,
      state: "fully_paid",
      label: "Fully paid",
    });
  });

  it("reports an overpayment without negative outstanding", () => {
    expect(summariseCollection(10_000, [10_500], 90)).toMatchObject({
      received: 10_500,
      outstanding: 0,
      overpaid: 500,
      pctPaid: 105,
      state: "fully_paid",
    });
  });

  it("has nothing to collect on a zero invoice", () => {
    expect(summariseCollection(0, [], 90)).toMatchObject({
      outstanding: 0,
      pctPaid: 0,
      state: "no_invoice",
    });
    expect(summariseCollection(0, [100], 90)).toMatchObject({
      overpaid: 100,
      pctPaid: 0,
      state: "no_invoice",
    });
  });

  it("has nothing received before any payment", () => {
    expect(summariseCollection(10_000, [], 90)).toMatchObject({
      received: 0,
      outstanding: 10_000,
      pctPaid: 0,
      state: "partial",
      label: "0% paid",
    });
  });
});
