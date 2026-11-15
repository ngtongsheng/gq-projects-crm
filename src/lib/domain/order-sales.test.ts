import { describe, expect, it } from "vitest";
import {
  hasSalesInYear,
  orderInvoice,
  type SalesOrder,
  salesIn,
} from "./order-sales";

const order: SalesOrder = {
  loaDate: "2026-03-10",
  contractSum: 10_000.1,
  variationOrders: [
    { confirmedOn: "2026-03-10", amount: 500 },
    { confirmedOn: "2026-05-20", amount: 2_000.2 },
    { confirmedOn: "2026-06-02", amount: -300 },
  ],
};

describe("salesIn", () => {
  it("counts the contract sum and a backfilled VO in the LOA month", () => {
    expect(salesIn(order, "2026-03")).toBe(10_500.1);
  });

  it("counts only a later VO's amount in its own month", () => {
    expect(salesIn(order, "2026-05")).toBe(2_000.2);
    expect(salesIn(order, "2026-06")).toBe(-300);
  });

  it("counts nothing in a month without the LOA or a VO", () => {
    expect(salesIn(order, "2026-04")).toBe(0);
  });

  it("adds up to the invoice over the year", () => {
    expect(salesIn(order, "2026-")).toBe(orderInvoice(order));
    expect(orderInvoice(order)).toBe(12_200.3);
  });
});

describe("hasSalesInYear", () => {
  it("is true for a VO confirmed in a later year than the LOA", () => {
    const late: SalesOrder = {
      loaDate: "2025-12-20",
      contractSum: 1_000,
      variationOrders: [{ confirmedOn: "2026-01-05", amount: 100 }],
    };
    expect(hasSalesInYear(late, 2026)).toBe(true);
    expect(hasSalesInYear(late, 2025)).toBe(true);
    expect(hasSalesInYear(late, 2024)).toBe(false);
  });
});
