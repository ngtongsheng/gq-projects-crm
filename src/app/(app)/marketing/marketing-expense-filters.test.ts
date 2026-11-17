import { describe, expect, it } from "vitest";
import {
  expenseFiltersFromParams,
  expenseLogHref,
  expenseMonths,
  filterExpenses,
  totalRm,
} from "./marketing-expense-filters";
import type { MarketingExpense } from "./marketing-types";

const line = (fields: Partial<MarketingExpense>): MarketingExpense => ({
  id: crypto.randomUUID(),
  spentOn: "2026-11-01",
  categoryId: "cat-folder",
  description: "Folders",
  vendorName: "Mega Print",
  invoiceRef: null,
  currency: "RM",
  amount: 100,
  amountRm: 100,
  eventId: null,
  eventName: null,
  paymentMethod: "bank_transfer",
  remarks: null,
  createdAt: "2026-11-01T01:00:00Z",
  ...fields,
});

const everything = { month: "", categoryId: "", query: "" };

describe("filterExpenses", () => {
  const nov = line({ description: "Courier", spentOn: "2026-11-10" });
  const octEarly = line({
    spentOn: "2026-10-02",
    createdAt: "2026-10-02T01:00:00Z",
    categoryId: "cat-events",
  });
  const octLateAdded = line({
    spentOn: "2026-10-02",
    createdAt: "2026-10-02T09:00:00Z",
    eventName: "Carpet Expo",
    invoiceRef: "INV-77",
    remarks: "paid in cash",
  });
  const all = [octEarly, nov, octLateAdded];

  it("lists newest date first, then the line added last", () => {
    expect(filterExpenses(all, everything)).toEqual([
      nov,
      octLateAdded,
      octEarly,
    ]);
  });

  it("narrows by month and by category", () => {
    expect(filterExpenses(all, { ...everything, month: "2026-10" })).toEqual([
      octLateAdded,
      octEarly,
    ]);
    expect(
      filterExpenses(all, { ...everything, categoryId: "cat-events" }),
    ).toEqual([octEarly]);
  });

  it("searches description, vendor, ref, event and remarks, ignoring capitals", () => {
    for (const query of ["courier", "MEGA", "inv-77", "expo", "in cash"]) {
      expect(
        filterExpenses(all, { ...everything, query }).length,
      ).toBeGreaterThan(0);
    }
    expect(filterExpenses(all, { ...everything, query: "zzz" })).toEqual([]);
  });
});

describe("expenseMonths", () => {
  it("lists each month once, newest first", () => {
    expect(
      expenseMonths([
        line({ spentOn: "2026-10-02" }),
        line({ spentOn: "2026-11-10" }),
        line({ spentOn: "2026-10-30" }),
      ]),
    ).toEqual(["2026-11", "2026-10"]);
  });
});

describe("totalRm", () => {
  it("adds in cents so the cents do not drift", () => {
    expect(totalRm([line({ amountRm: 0.1 }), line({ amountRm: 0.2 })])).toBe(
      0.3,
    );
  });
});

describe("expenseLogHref and expenseFiltersFromParams", () => {
  it("round-trips the filters a dashboard link sets", () => {
    const href = expenseLogHref({
      month: "2026-03",
      categoryId: "cat-folder",
      query: "Mega Print & Co",
    });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(params.view).toBe("expenses");
    expect(expenseFiltersFromParams(params, new Set(["cat-folder"]))).toEqual({
      month: "2026-03",
      categoryId: "cat-folder",
      query: "Mega Print & Co",
    });
  });

  it("drops a month that is not a month and a category that does not exist", () => {
    expect(
      expenseFiltersFromParams(
        { month: "march", category: "gone" },
        new Set(["cat-folder"]),
      ),
    ).toEqual(everything);
  });
});
