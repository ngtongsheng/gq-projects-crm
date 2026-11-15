import { describe, expect, it } from "vitest";
import {
  buildCompanyRows,
  filterCompanies,
  parseCompanyFilters,
} from "./company-rows";

const MEI = "11111111-1111-4111-8111-111111111111";
const ARUN = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-11-15";

const names = new Map([
  [MEI, "Mei"],
  [ARUN, "Arun"],
]);

const companies = [
  {
    id: "c2",
    name: "Bina Jaya",
    companyType: "contractor" as const,
    rating: 3,
    accountType: null,
  },
  {
    id: "c1",
    name: "Atlas Interiors",
    companyType: "designer" as const,
    rating: 5,
    accountType: "own" as const,
  },
  {
    id: "c3",
    name: "Empty Co",
    companyType: "designer" as const,
    rating: 3,
    accountType: null,
  },
];
const people = [
  { id: "p1", companyId: "c1", name: "Lim Wei", ownerIds: [MEI] },
  { id: "p2", companyId: "c1", name: "Ann Tan", ownerIds: [ARUN, MEI] },
  { id: "p3", companyId: "c2", name: "Siti Aminah", ownerIds: [ARUN] },
];
const lastVisits = new Map([
  ["p1", "2026-10-01"],
  ["p2", "2026-11-10"],
  ["p3", "2026-08-01"],
]);

const rows = buildCompanyRows(companies, people, lastVisits, names, TODAY);
const filter = (params: Record<string, string>) =>
  filterCompanies(rows, parseCompanyFilters(params)).map((r) => r.name);

describe("buildCompanyRows", () => {
  it("lists companies by name", () => {
    expect(rows.map((r) => r.name)).toEqual([
      "Atlas Interiors",
      "Bina Jaya",
      "Empty Co",
    ]);
  });

  it("derives salespeople as the distinct owners of its people, by name", () => {
    expect(rows[0]?.salespeople).toEqual([
      { id: ARUN, name: "Arun" },
      { id: MEI, name: "Mei" },
    ]);
    expect(rows[2]?.salespeople).toEqual([]);
  });

  it("takes the latest visit across its people", () => {
    expect(rows[0]?.lastVisit).toBe("2026-11-10");
    expect(rows[0]?.status.kind).toBe("active");
    expect(rows[1]?.status).toEqual({ kind: "no_visit", idleDays: 106 });
    expect(rows[2]?.lastVisit).toBeNull();
    expect(rows[2]?.status.kind).toBe("none");
  });

  it("lists people by name", () => {
    expect(rows[0]?.people.map((p) => p.name)).toEqual(["Ann Tan", "Lim Wei"]);
  });
});

describe("filterCompanies", () => {
  it("returns everything with no filters", () => {
    expect(filter({})).toHaveLength(3);
  });

  it("searches company and person names", () => {
    expect(filter({ q: "atlas" })).toEqual(["Atlas Interiors"]);
    expect(filter({ q: "siti" })).toEqual(["Bina Jaya"]);
  });

  it("filters by salesperson and type", () => {
    expect(filter({ owner: ARUN })).toEqual(["Atlas Interiors", "Bina Jaya"]);
    expect(filter({ type: "contractor" })).toEqual(["Bina Jaya"]);
  });

  it("filters inactive to no visit 90+ days or never visited", () => {
    expect(filter({ status: "inactive" })).toEqual(["Bina Jaya", "Empty Co"]);
  });

  it("filters quiet to 61 to 90 days", () => {
    const quiet = buildCompanyRows(
      companies,
      people,
      new Map([["p3", "2026-08-30"]]),
      names,
      TODAY,
    );
    expect(
      filterCompanies(quiet, parseCompanyFilters({ status: "quiet" })).map(
        (r) => r.name,
      ),
    ).toEqual(["Bina Jaya"]);
  });

  it("ignores unrecognised filter values", () => {
    expect(
      filter({ type: "nonsense", status: "all", owner: "all" }),
    ).toHaveLength(3);
  });
});
