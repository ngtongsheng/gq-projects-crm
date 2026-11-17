import { describe, expect, it } from "vitest";
import type { MarketingVendor } from "./marketing-types";
import {
  filterVendors,
  vendorRows,
  vendorTabCounts,
} from "./marketing-vendors";

const vendor = (fields: Partial<MarketingVendor>): MarketingVendor => ({
  id: crypto.randomUUID(),
  kind: "company",
  name: "Mega Print",
  supplies: null,
  contactPerson: null,
  skills: [],
  rate: null,
  portfolioUrl: null,
  phone: null,
  email: null,
  notes: null,
  payments: [],
  prepaidEntries: 0,
  ...fields,
});

describe("vendorRows", () => {
  it("totals only the chosen year and shows the latest payment of any year", () => {
    const [row] = vendorRows(
      [
        vendor({
          payments: [
            { spentOn: "2026-01-05", amountRm: 0.1 },
            { spentOn: "2026-03-10", amountRm: 0.2 },
            { spentOn: "2025-12-31", amountRm: 500 },
          ],
        }),
      ],
      "2026",
    );
    expect(row).toMatchObject({
      invoices: 2,
      total: 0.3,
      lastPaidOn: "2026-03-10",
    });
    expect(
      vendorRows(
        [vendor({ payments: [{ spentOn: "2025-12-31", amountRm: 5 }] })],
        "2026",
      )[0],
    ).toMatchObject({ invoices: 0, total: 0, lastPaidOn: "2025-12-31" });
  });

  it("has no last paid date before the first payment", () => {
    expect(vendorRows([vendor({})], "2026")[0]).toMatchObject({
      total: 0,
      lastPaidOn: null,
      used: 0,
    });
  });

  it("counts expenses and prepaid entries as use, which blocks a delete", () => {
    const rows = vendorRows(
      [
        vendor({ payments: [{ spentOn: "2026-01-05", amountRm: 10 }] }),
        vendor({ prepaidEntries: 2 }),
      ],
      "2026",
    );
    expect(rows.map((row) => row.used)).toEqual([1, 2]);
  });
});

describe("filterVendors", () => {
  const rows = vendorRows(
    [
      vendor({
        name: "Mega Print",
        supplies: "printing",
        contactPerson: "Aisha",
        payments: [{ spentOn: "2026-02-01", amountRm: 100 }],
      }),
      vendor({
        name: "Ben Lee",
        kind: "part_timer",
        skills: ["photography"],
        email: "ben@example.com",
        notes: "Weekends only",
        payments: [{ spentOn: "2026-02-01", amountRm: 900 }],
      }),
      vendor({ name: "Alpha Courier", supplies: "courier_logistics" }),
    ],
    "2026",
  );
  const all = { tab: "all", query: "", sort: "name" } as const;

  it("counts each tab", () => {
    expect(vendorTabCounts(rows)).toEqual({
      all: 3,
      company: 2,
      part_timer: 1,
    });
  });

  it("sorts A to Z or highest spend first", () => {
    expect(filterVendors(rows, all).map((r) => r.name)).toEqual([
      "Alpha Courier",
      "Ben Lee",
      "Mega Print",
    ]);
    expect(
      filterVendors(rows, { ...all, sort: "spend" }).map((r) => r.name),
    ).toEqual(["Ben Lee", "Mega Print", "Alpha Courier"]);
  });

  it("filters by tab", () => {
    expect(
      filterVendors(rows, { ...all, tab: "part_timer" }).map((r) => r.name),
    ).toEqual(["Ben Lee"]);
  });

  it.each([
    ["name", "mega", "Mega Print"],
    ["supply", "courier &", "Alpha Courier"],
    ["contact person", "aisha", "Mega Print"],
    ["email", "ben@", "Ben Lee"],
    ["skill", "photo", "Ben Lee"],
    ["note", "weekends", "Ben Lee"],
  ])("searches the %s", (_field, query, name) => {
    expect(filterVendors(rows, { ...all, query }).map((r) => r.name)).toEqual([
      name,
    ]);
  });
});
