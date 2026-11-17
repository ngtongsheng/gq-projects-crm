import { describe, expect, it } from "vitest";
import {
  barLabel,
  dashboardYears,
  eventCostRows,
  summariseYear,
} from "./marketing-dashboard";
import type { MarketingCategory, MarketingExpense } from "./marketing-types";

const categories: MarketingCategory[] = [
  { id: "folder", name: "Folder", used: 0 },
  { id: "courier", name: "Courier", used: 0 },
];

const line = (fields: Partial<MarketingExpense>): MarketingExpense => ({
  id: crypto.randomUUID(),
  spentOn: "2026-03-10",
  categoryId: "folder",
  description: "x",
  vendorName: "Mega Print",
  invoiceRef: null,
  currency: "RM",
  amount: 100,
  amountRm: 100,
  eventId: null,
  eventName: null,
  paymentMethod: "bank_transfer",
  remarks: null,
  createdAt: "2026-03-10T01:00:00Z",
  ...fields,
});

const summary = (expenses: MarketingExpense[], today = "2026-11-17") =>
  summariseYear(expenses, categories, "2026", today);

describe("summariseYear totals", () => {
  const expenses = [
    line({ spentOn: "2026-01-05", amountRm: 100 }),
    line({ spentOn: "2026-01-20", amountRm: 0.1 }),
    line({ spentOn: "2026-01-21", amountRm: 0.2, categoryId: "courier" }),
    line({ spentOn: "2026-03-02", amountRm: 300, categoryId: "courier" }),
    line({ spentOn: "2025-12-31", amountRm: 999 }),
  ];
  const result = summary(expenses);

  it("adds up per category and month, in cents", () => {
    expect(result.rows[0].months[0]).toBe(100.1);
    expect(result.rows[1].months[0]).toBe(0.2);
    expect(result.rows[1].months[2]).toBe(300);
    expect(result.monthTotals[0]).toBe(100.3);
    expect(result.rows[1].total).toBe(300.2);
    expect(result.total).toBe(400.3);
  });

  it("leaves out other years", () => {
    expect(
      summariseYear(expenses, categories, "2025", "2026-11-17").total,
    ).toBe(999);
  });

  it("averages over months with spend and finds the highest month", () => {
    expect(result.monthsWithSpend).toBe(2);
    expect(result.average).toBeCloseTo(200.15);
    expect(result.highest).toEqual({ month: "2026-03", amount: 300 });
  });

  it("has no highest month and a zero average for a year without spend", () => {
    const empty = summariseYear([], categories, "2026", "2026-11-17");
    expect(empty.highest).toBeNull();
    expect(empty.average).toBe(0);
    expect(empty.monthsWithSpend).toBe(0);
  });
});

describe("summariseYear last month", () => {
  const expenses = [line({ spentOn: "2026-10-03", amountRm: 80 })];

  it("is the month before today", () => {
    expect(summary(expenses).lastMonth).toEqual({
      month: "2026-10",
      amount: 80,
    });
  });

  it("is 0 when that month falls in another year", () => {
    expect(summary(expenses, "2027-01-04").lastMonth).toEqual({
      month: "2026-12",
      amount: 0,
    });
    expect(
      summariseYear(expenses, categories, "2027", "2027-01-04").lastMonth,
    ).toEqual({ month: "2026-12", amount: 0 });
  });
});

describe("summariseYear change vs previous month", () => {
  it("shows a rise or fall only when both months have spend", () => {
    const result = summary([
      line({ spentOn: "2026-01-05", amountRm: 100 }),
      line({ spentOn: "2026-02-05", amountRm: 150 }),
      line({ spentOn: "2026-03-05", amountRm: 75 }),
      line({ spentOn: "2026-05-05", amountRm: 75 }),
    ]);
    expect(result.changes[0]).toBeNull();
    expect(result.changes[1]).toEqual({ rising: true, percent: 50 });
    expect(result.changes[2]).toEqual({ rising: false, percent: 50 });
    expect(result.changes[3]).toBeNull();
    expect(result.changes[4]).toBeNull();
  });
});

describe("summariseYear vendors", () => {
  const result = summary([
    line({ vendorName: "Mega Print", amountRm: 200, categoryId: "folder" }),
    line({ vendorName: "Mega Print", amountRm: 50, categoryId: "courier" }),
    line({ vendorName: "Mega Print", amountRm: 50, categoryId: "folder" }),
    line({ vendorName: "Fast Courier", amountRm: 100, categoryId: "courier" }),
  ]);

  it("ranks vendors by spend with invoices, main category and share", () => {
    expect(result.vendors).toEqual([
      {
        name: "Mega Print",
        mainCategoryId: "folder",
        invoices: 3,
        total: 300,
        percent: 75,
      },
      {
        name: "Fast Courier",
        mainCategoryId: "courier",
        invoices: 1,
        total: 100,
        percent: 25,
      },
    ]);
  });
});

describe("dashboardYears", () => {
  it("lists years with spend and this year, newest first", () => {
    expect(
      dashboardYears(
        [line({ spentOn: "2024-02-01" }), line({ spentOn: "2025-02-01" })],
        "2026-11-17",
      ),
    ).toEqual(["2026", "2025", "2024"]);
  });
});

describe("eventCostRows", () => {
  it("adds each event's cost lines, by event name", () => {
    expect(
      eventCostRows([
        { eventId: "b", eventName: "Expo", total: 10.1 },
        { eventId: "a", eventName: "Autumn fair", total: 5 },
        { eventId: "b", eventName: "Expo", total: 0.2 },
      ]),
    ).toEqual([
      { eventId: "a", name: "Autumn fair", total: 5 },
      { eventId: "b", name: "Expo", total: 10.3 },
    ]);
  });
});

describe("barLabel", () => {
  it("shortens from 1,000 up", () => {
    expect(barLabel(450)).toBe("450");
    expect(barLabel(12400)).toBe("12k");
  });
});
