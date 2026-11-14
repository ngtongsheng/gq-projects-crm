import { describe, expect, it } from "vitest";
import { applyRegisterFilters, parseRegisterFilters } from "./register-filters";

type TestRow = {
  quoteNo: string;
  projectName: string;
  customerName: string;
  salespersonName: string;
  status: "draft" | "submitted" | "approved" | "returned";
  amount: number;
  updatedAt: string;
};

const row = (quoteNo: string, extra: Partial<TestRow> = {}): TestRow => ({
  quoteNo,
  projectName: "Tower",
  customerName: "Acme",
  salespersonName: "Ah Kow",
  status: "draft",
  amount: 100,
  updatedAt: "2026-11-01T00:00:00+00:00",
  ...extra,
});

describe("parseRegisterFilters", () => {
  it("reads search, status and sort from the address bar", () => {
    expect(
      parseRegisterFilters({
        search: " gq51 ",
        status: "approved",
        sort: "amount",
      }),
    ).toEqual({ search: "gq51", status: "approved", sort: "amount" });
  });

  it("falls back on anything unrecognised", () => {
    expect(
      parseRegisterFilters({ search: "", status: "nope", sort: ["x", "y"] }),
    ).toEqual({ search: undefined, status: undefined, sort: "updated" });
  });
});

describe("applyRegisterFilters", () => {
  const rows = [
    row("GQ5158", { amount: 500, updatedAt: "2026-11-03T00:00:00+00:00" }),
    row("GQ5127", {
      customerName: "Beta Hotel",
      status: "submitted",
      amount: 900,
      updatedAt: "2026-11-05T00:00:00+00:00",
    }),
    row("GQ5001", { salespersonName: "Mei Ling", status: "approved" }),
  ];

  it("lists the most recently updated first by default", () => {
    const result = applyRegisterFilters(rows, parseRegisterFilters({}));
    expect(result.map((r) => r.quoteNo)).toEqual([
      "GQ5127",
      "GQ5158",
      "GQ5001",
    ]);
  });

  it("searches number, project, customer and salesperson, ignoring case", () => {
    const search = (text: string) =>
      applyRegisterFilters(rows, parseRegisterFilters({ search: text })).map(
        (r) => r.quoteNo,
      );
    expect(search("gq5158")).toEqual(["GQ5158"]);
    expect(search("beta")).toEqual(["GQ5127"]);
    expect(search("mei")).toEqual(["GQ5001"]);
    expect(search("tower")).toHaveLength(3);
  });

  it("filters by status", () => {
    const result = applyRegisterFilters(
      rows,
      parseRegisterFilters({ status: "submitted" }),
    );
    expect(result.map((r) => r.quoteNo)).toEqual(["GQ5127"]);
  });

  it("sorts by amount or by number", () => {
    const byAmount = applyRegisterFilters(
      rows,
      parseRegisterFilters({ sort: "amount" }),
    );
    expect(byAmount.map((r) => r.quoteNo)).toEqual([
      "GQ5127",
      "GQ5158",
      "GQ5001",
    ]);
    const byNo = applyRegisterFilters(
      rows,
      parseRegisterFilters({ sort: "quoteNo" }),
    );
    expect(byNo.map((r) => r.quoteNo)).toEqual(["GQ5001", "GQ5127", "GQ5158"]);
  });
});
