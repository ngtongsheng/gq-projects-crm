import { describe, expect, it } from "vitest";
import {
  type FilterableCustomer,
  filterCustomers,
  parseCustomerFilters,
  parseCustomersView,
} from "./customer-filters";

const MEI = "11111111-1111-4111-8111-111111111111";
const ARUN = "22222222-2222-4222-8222-222222222222";

const rows: FilterableCustomer[] = [
  {
    name: "Lim Wei",
    companyName: "Atlas Interiors",
    mobile: "60123456789",
    rating: 5,
    accountType: "own",
    ownerIds: [MEI],
  },
  {
    name: "Siti Aminah",
    companyName: "Bina Jaya",
    mobile: "60198765432",
    rating: 3,
    accountType: "pass_down",
    ownerIds: [ARUN, MEI],
  },
];

const filter = (params: Record<string, string>) =>
  filterCustomers(rows, parseCustomerFilters(params)).map((r) => r.name);

describe("filterCustomers", () => {
  it("returns everyone with no filters", () => {
    expect(filter({})).toEqual(["Lim Wei", "Siti Aminah"]);
  });

  it("searches name, company and mobile in any format", () => {
    expect(filter({ q: "siti" })).toEqual(["Siti Aminah"]);
    expect(filter({ q: "atlas" })).toEqual(["Lim Wei"]);
    expect(filter({ q: "012-345 6789" })).toEqual(["Lim Wei"]);
    expect(filter({ q: "019876" })).toEqual(["Siti Aminah"]);
    expect(filter({ q: "nobody" })).toEqual([]);
  });

  it("filters by owner, rating and account type together", () => {
    expect(filter({ owner: ARUN })).toEqual(["Siti Aminah"]);
    expect(filter({ owner: MEI })).toEqual(["Lim Wei", "Siti Aminah"]);
    expect(filter({ rating: "5" })).toEqual(["Lim Wei"]);
    expect(filter({ account: "pass_down", owner: MEI })).toEqual([
      "Siti Aminah",
    ]);
  });

  it("treats 'all' and junk as no filter", () => {
    expect(filter({ owner: "all", rating: "all", account: "all" })).toEqual([
      "Lim Wei",
      "Siti Aminah",
    ]);
    expect(filter({ rating: "9", account: "bogus" })).toHaveLength(2);
  });
});

describe("parseCustomersView", () => {
  it("shows companies unless the link asks for people", () => {
    expect(parseCustomersView({})).toBe("companies");
    expect(parseCustomersView({ view: "people" })).toBe("people");
    expect(parseCustomersView({ view: "bogus" })).toBe("companies");
    expect(parseCustomersView({ view: ["people", "x"] })).toBe("companies");
  });
});
