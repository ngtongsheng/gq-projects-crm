import { expect, test } from "vitest";
import { attentionItems, attentionKeysFor, attentionTotal } from "./attention";

const facts = {
  ownershipRequests: 2,
  overdueProjects: 3,
  staleProjects: 1,
  inactiveCustomers: 4,
  lateReports: 1,
  ownReport: 1,
  pendingOvertime: 5,
  overdueFollowUps: 2,
  pendingBookings: 3,
  claimsToVerify: 1,
  overdueSupplierPos: 2,
  missingSupplierPos: 1,
  unsignedDos: 6,
  stockHolds: 2,
  creditNotes: 1,
};

test("the MD and Sales Director see companies nobody has visited for 3 months, in red; salespeople do not", () => {
  const withReleased = { releasedCompanies: 3 };
  for (const role of ["md", "director"] as const) {
    expect(
      attentionItems(role, withReleased).find(
        (item) => item.key === "releasedCompanies",
      ),
    ).toMatchObject({
      count: 3,
      href: "/customers?released=yes",
      tone: "bad",
      label: "3 companies nobody has visited for 3 months",
    });
  }
  expect(attentionItems("sales", withReleased)).toEqual([]);
  expect(attentionItems("md", { releasedCompanies: 1 })[0].label).toBe(
    "1 company nobody has visited for 3 months",
  );
});

test("each role sees only the kinds it acts on, with counts and links", () => {
  const sales = attentionItems("sales", facts);
  expect(sales.map((item) => item.key)).toEqual([
    "ownReport",
    "overdueProjects",
    "staleProjects",
    "inactiveCustomers",
  ]);
  expect(sales.find((item) => item.key === "overdueProjects")).toMatchObject({
    count: 3,
    href: "/projects",
    tone: "bad",
    label: "3 projects past the next action date",
  });

  expect(attentionItems("site", facts).map((item) => item.key)).toEqual([
    "pendingBookings",
    "overdueFollowUps",
    "claimsToVerify",
    "ownReport",
  ]);
  expect(attentionItems("accounts", facts).map((item) => item.key)).toEqual([
    "lateReports",
  ]);
});

test("kinds at zero or missing are left out", () => {
  const items = attentionItems("support", {
    overdueSupplierPos: 0,
    unsignedDos: 2,
  });
  expect(items.map((item) => item.key)).toEqual(["unsignedDos"]);
  expect(attentionItems("md", {})).toEqual([]);
});

test("one is singular", () => {
  const [item] = attentionItems("director", { ownershipRequests: 1 });
  expect(item.label).toBe("1 ownership request to decide");
});

test("the BD Director's own report links to the Director Report", () => {
  const [bd] = attentionItems("bd", { ownReport: 1 });
  const [sales] = attentionItems("sales", { ownReport: 1 });
  expect(bd.href).toBe("/reports/director");
  expect(sales.href).toBe("/reports");
});

test("the total adds the counts of the items shown", () => {
  expect(attentionTotal(attentionItems("sales", facts))).toBe(1 + 3 + 1 + 4);
  expect(attentionTotal([])).toBe(0);
});

test("every role has a list of kinds", () => {
  for (const role of [
    "md",
    "director",
    "bd",
    "sales",
    "accounts",
    "site",
    "support",
  ] as const) {
    expect(attentionKeysFor(role).length).toBeGreaterThan(0);
  }
});
