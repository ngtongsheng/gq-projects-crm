import { describe, expect, it } from "vitest";
import {
  exchangeRateText,
  formatForeign,
  statementRows,
  usedByCurrency,
} from "./marketing-prepaid";
import type { PrepaidEntry } from "./marketing-types";

const EUROPE = "11111111-1111-4111-8111-111111111111";
const PRINTER = "22222222-2222-4222-8222-222222222222";

let sequence = 0;
const entry = (fields: Partial<PrepaidEntry>): PrepaidEntry => {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    entryOn: "2026-05-01",
    vendorId: EUROPE,
    vendorName: "Europe designer",
    kind: "top_up",
    description: null,
    foreignCurrency: null,
    foreignAmount: null,
    amountRm: 100,
    mofRef: null,
    marketingFoc: false,
    remarks: null,
    createdAt: "2026-05-01T08:00:00Z",
    ...fields,
  };
};

describe("statementRows", () => {
  it("runs the balance by date, so a backdated top-up counts before the job it paid for", () => {
    const rows = statementRows(
      [
        entry({
          kind: "deduction",
          description: "Hotel Seri",
          amountRm: 300,
          entryOn: "2026-05-10",
          createdAt: "2026-05-10T08:00:00Z",
        }),
        // Typed in later, but paid earlier.
        entry({
          amountRm: 1000,
          entryOn: "2026-05-02",
          createdAt: "2026-05-12T08:00:00Z",
        }),
      ],
      EUROPE,
    );
    expect(rows.map((row) => [row.kind, row.runningBalance])).toEqual([
      ["top_up", 1000],
      ["deduction", 700],
    ]);
  });

  it("orders entries of the same day by when they were made", () => {
    const rows = statementRows(
      [
        entry({
          kind: "deduction",
          description: "Second",
          amountRm: 50,
          createdAt: "2026-05-01T10:00:00Z",
        }),
        entry({ amountRm: 200, createdAt: "2026-05-01T09:00:00Z" }),
      ],
      EUROPE,
    );
    expect(rows.map((row) => row.runningBalance)).toEqual([200, 150]);
  });

  it("goes negative when jobs outrun the top-ups", () => {
    const [row] = statementRows(
      [entry({ kind: "deduction", description: "Job", amountRm: 80 })],
      EUROPE,
    );
    expect(row?.runningBalance).toBe(-80);
  });

  it("keeps each vendor's balance apart in the all-vendors statement", () => {
    const rows = statementRows(
      [
        entry({ amountRm: 500 }),
        entry({
          vendorId: PRINTER,
          vendorName: "Alpha Print",
          amountRm: 40,
        }),
        entry({
          kind: "deduction",
          description: "Job",
          amountRm: 100,
          entryOn: "2026-05-03",
        }),
      ],
      null,
    );
    expect(rows.map((row) => [row.vendorName, row.runningBalance])).toEqual([
      ["Alpha Print", 40],
      ["Europe designer", 500],
      ["Europe designer", 400],
    ]);
  });

  it("adds in cents", () => {
    const rows = statementRows(
      [
        entry({ amountRm: 0.1, createdAt: "2026-05-01T08:00:00Z" }),
        entry({ amountRm: 0.2, createdAt: "2026-05-01T09:00:00Z" }),
      ],
      EUROPE,
    );
    expect(rows.at(-1)?.runningBalance).toBe(0.3);
  });
});

describe("usedByCurrency", () => {
  it("sums the foreign amount of jobs per currency and skips top-ups and RM", () => {
    expect(
      usedByCurrency(
        [
          entry({
            kind: "deduction",
            description: "A",
            foreignCurrency: "EUR",
            foreignAmount: 60,
          }),
          entry({
            kind: "deduction",
            description: "B",
            foreignCurrency: "EUR",
            foreignAmount: 40.5,
          }),
          entry({
            kind: "deduction",
            description: "C",
            foreignCurrency: "RM",
            foreignAmount: 10,
          }),
          entry({ foreignCurrency: "USD", foreignAmount: 999 }),
        ],
        EUROPE,
      ),
    ).toEqual([{ currency: "EUR", amount: 100.5 }]);
  });
});

describe("exchangeRateText", () => {
  it("shows RM per unit of foreign currency to four places", () => {
    expect(exchangeRateText(288, 60, "EUR")).toBe("RM 4.8000 per EUR");
  });

  it("shows nothing for RM or while an amount is missing", () => {
    expect(exchangeRateText(100, 100, "RM")).toBeNull();
    expect(exchangeRateText(0, 60, "EUR")).toBeNull();
    expect(exchangeRateText(288, 0, "EUR")).toBeNull();
  });
});

describe("formatForeign", () => {
  it("puts the currency before the amount", () => {
    expect(formatForeign("RMB", 2700)).toBe("RMB 2700.00");
  });
});
