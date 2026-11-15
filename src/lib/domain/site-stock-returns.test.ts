import { describe, expect, it } from "vitest";
import { type StockReturnLog, stockReturnEntries } from "./site-stock-returns";

const log = (change: Partial<StockReturnLog> = {}): StockReturnLog => ({
  visitedOn: "2026-11-10",
  supervisorId: "sup-1",
  activity: "installation",
  mofId: "mof-1",
  mofNo: "P1001",
  siteLabel: "Tower A",
  returnAnswer: null,
  ...change,
});

describe("stockReturnEntries", () => {
  it("lists a visit that left balance stock to return", () => {
    const entries = stockReturnEntries([
      log({ returnAnswer: "Balance stock: 5 box Grey tile (Installer)" }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      sentBack: false,
      items: "5 box Grey tile (Installer)",
    });
  });

  it("skips visits that said there was none, or said nothing", () => {
    expect(
      stockReturnEntries([
        log({ returnAnswer: "No balance stock" }),
        log({ returnAnswer: null, visitedOn: "2026-11-09" }),
      ]),
    ).toEqual([]);
  });

  it("joins the stock return log and the answer on another log of the same visit", () => {
    const entries = stockReturnEntries([
      log({
        activity: "inspection",
        returnAnswer: "Stock return: 2 roll Vinyl",
      }),
      log({ activity: "stock_return" }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ sentBack: true, items: "2 roll Vinyl" });
  });

  it("keeps a stock return with no answer", () => {
    const entries = stockReturnEntries([log({ activity: "stock_return" })]);
    expect(entries[0]).toMatchObject({ sentBack: true, items: "" });
  });

  it("keeps different days and sites apart, newest first", () => {
    const answer = "Balance stock: 1 pcs Skirting";
    const entries = stockReturnEntries([
      log({ returnAnswer: answer, visitedOn: "2026-11-08" }),
      log({ returnAnswer: answer, visitedOn: "2026-11-10" }),
      log({
        returnAnswer: answer,
        visitedOn: "2026-11-10",
        mofId: null,
        siteLabel: "Shop 3",
      }),
    ]);
    expect(entries.map((entry) => entry.visitedOn)).toEqual([
      "2026-11-10",
      "2026-11-10",
      "2026-11-08",
    ]);
  });
});
