import { expect, test } from "vitest";
import {
  agedBalances,
  type RollupOrder,
  salespersonRows,
  salesTotals,
  stageRows,
  yearPace,
} from "./order-rollup";

const today = "2026-11-12";

const order = (overrides: Partial<RollupOrder> = {}): RollupOrder => ({
  salespersonId: "a",
  loaDate: "2026-11-03",
  stage: "ordered",
  invoiceDate: null,
  invoice: 1000,
  outstanding: 0,
  ...overrides,
});

test("sales totals split this month from this year", () => {
  const totals = salesTotals(
    [
      order({ loaDate: "2026-11-03", invoice: 100.1 }),
      order({ loaDate: "2026-11-10", invoice: 200.2 }),
      order({ loaDate: "2026-03-01", invoice: 50 }),
      order({ loaDate: "2025-11-20", invoice: 999 }),
    ],
    today,
  );
  expect(totals.month).toEqual({ count: 2, value: 300.3 });
  expect(totals.year).toEqual({ count: 3, value: 350.3 });
});

test("stage rows keep the order of the journey and skip cancelled", () => {
  const rows = stageRows([
    order({ stage: "closed", invoice: 10 }),
    order({ stage: "ordered", invoice: 20, outstanding: 5 }),
    order({ stage: "ordered", invoice: 30, outstanding: 5 }),
  ]);
  expect(rows.map((row) => row.stage)).not.toContain("cancelled");
  expect(rows.find((row) => row.stage === "ordered")).toEqual({
    stage: "ordered",
    count: 2,
    invoice: 50,
    outstanding: 10,
  });
  expect(rows.find((row) => row.stage === "in_production")?.count).toBe(0);
});

test("aged balances band by days since the invoice date", () => {
  const rows = agedBalances(
    [
      order({ invoiceDate: "2026-11-02", outstanding: 100 }),
      order({ invoiceDate: "2026-10-13", outstanding: 50 }),
      order({ invoiceDate: "2026-10-12", outstanding: 25 }),
      order({ invoiceDate: "2026-08-01", outstanding: 10 }),
      order({ invoiceDate: null, outstanding: 5 }),
      order({ invoiceDate: "2026-01-01", outstanding: 0 }),
    ],
    today,
  );
  const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));
  // 10 days, 30 days, 31 days, 103 days.
  expect(byLabel["0-30 days"]).toMatchObject({ count: 2, outstanding: 150 });
  expect(byLabel["31-60 days"]).toMatchObject({ count: 1, outstanding: 25 });
  expect(byLabel["61-90 days"].count).toBe(0);
  expect(byLabel["Over 90 days"]).toMatchObject({ count: 1, outstanding: 10 });
  expect(byLabel["No invoice date yet"]).toMatchObject({
    count: 1,
    outstanding: 5,
  });
});

test("salesperson rows total the year and the unpaid balance", () => {
  const rows = salespersonRows(
    [
      order({ salespersonId: "a", invoice: 100, outstanding: 40 }),
      order({
        salespersonId: "a",
        loaDate: "2025-12-01",
        invoice: 500,
        outstanding: 60,
      }),
      order({ salespersonId: "b", invoice: 70 }),
    ],
    today,
  );
  expect(rows.find((row) => row.personId === "a")).toEqual({
    personId: "a",
    yearCount: 1,
    yearValue: 100,
    outstanding: 100,
  });
  expect(rows.find((row) => row.personId === "b")?.yearValue).toBe(70);
});

test("year pace is the months gone plus the share of this month", () => {
  // 1 Jan has 1 of 22 workdays gone; 2026-01-01 is a Thursday.
  expect(yearPace("2026-01-30")).toBeCloseTo(1 / 12, 1);
  expect(yearPace("2026-12-31")).toBeCloseTo(1, 5);
  expect(yearPace("2026-06-30")).toBeGreaterThan(0.49);
  expect(yearPace("2026-06-30")).toBeLessThan(0.51);
});
