import { describe, expect, it } from "vitest";
import type { JobRole } from "./job-role";
import {
  accessAllowed,
  canOpenPage,
  canSeeMargin,
  defaultAllowed,
  navPagesFor,
  type PageKey,
  type Viewer,
} from "./pages";

const viewer = (jobRole: JobRole, extra: Partial<Viewer> = {}): Viewer => ({
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  ...extra,
});

const navKeys = (person: Viewer, overrides = {}) =>
  navPagesFor(person, overrides).map((page) => page.key);

// The demo's tabsDefBase with ACCESS0 applied, keeping only pages built so far (claims is the
// Overtime page until Claims is built).
const DEFAULT_NAV: Record<string, { person: Viewer; keys: PageKey[] }> = {
  md: {
    person: viewer("md"),
    keys: [
      "dash",
      "cal",
      "inst",
      "cust",
      "proj",
      "mof",
      "site",
      "stock",
      "coll",
      "comm",
      "claims",
      "rep",
      "drep",
    ],
  },
  director: {
    person: viewer("director"),
    keys: [
      "dash",
      "cal",
      "inst",
      "cust",
      "proj",
      "site",
      "stock",
      "coll",
      "comm",
      "claims",
      "rep",
      "drep",
    ],
  },
  bd: {
    person: viewer("bd"),
    keys: [
      "dash",
      "cal",
      "inst",
      "cust",
      "proj",
      "mof",
      "site",
      "stock",
      "coll",
      "comm",
      "claims",
      "drep",
    ],
  },
  sales: {
    person: viewer("sales"),
    keys: [
      "dash",
      "cal",
      "inst",
      "cust",
      "proj",
      "site",
      "stock",
      "coll",
      "comm",
      "claims",
      "rep",
    ],
  },
  arrange: {
    person: viewer("sales", { arrangesStock: true }),
    keys: [
      "dash",
      "cal",
      "inst",
      "cust",
      "proj",
      "site",
      "stock",
      "coll",
      "comm",
      "claims",
      "rep",
    ],
  },
  accounts: {
    person: viewer("accounts"),
    keys: [
      "dash",
      "cal",
      "inst",
      "cust",
      "proj",
      "mof",
      "site",
      "stock",
      "coll",
      "comm",
      "claims",
      "rep",
      "drep",
    ],
  },
  site: { person: viewer("site"), keys: ["inst", "site", "srep", "claims"] },
  sellingSite: {
    person: viewer("site", { sells: true }),
    keys: ["inst", "site", "srep", "cust", "proj", "coll", "comm", "claims"],
  },
  ssup: { person: viewer("ssup"), keys: ["dash", "inst", "site", "stock"] },
  designer: { person: viewer("designer"), keys: ["dash"] },
  marketing: { person: viewer("marketing"), keys: ["dash", "site", "stock"] },
  support: {
    person: viewer("support"),
    keys: ["dash", "mof", "inst", "site", "stock"],
  },
};

describe("navPagesFor: defaults", () => {
  it.each(
    Object.entries(DEFAULT_NAV),
  )("%s gets the demo's default pages, in order", (_name, { person, keys }) => {
    expect(navKeys(person)).toEqual(keys);
  });

  it("uses the demo's wording per role", () => {
    const labels = (person: Viewer) =>
      navPagesFor(person, {}).map((page) => page.label);
    expect(labels(viewer("site"))).toEqual([
      "My schedule",
      "Site Work",
      "My Report",
      "My claims",
    ]);
    expect(labels(viewer("support"))).toEqual([
      "Dashboard",
      "MOF Register",
      "Delivery & Installation",
      "Site Work",
      "Stock",
    ]);
    expect(labels(viewer("marketing"))).toContain("Site photos");
  });

  it("sends managers to Team Reports and others to their own report", () => {
    const report = (person: Viewer) =>
      navPagesFor(person, {}).find((page) => page.key === "rep");
    expect(report(viewer("md"))).toMatchObject({
      label: "Team Reports",
      href: "/reports/team",
    });
    expect(report(viewer("sales"))).toMatchObject({
      label: "My Report",
      href: "/reports",
    });
  });

  it("hides pages that are not built, even from the MD", () => {
    expect(canOpenPage(viewer("md"), "cost", {})).toBe(false);
    expect(canOpenPage(viewer("md"), "leave", {})).toBe(false);
  });
});

describe("overrides", () => {
  it("hides a page from a role in the sidebar and at the page check", () => {
    const overrides = { sales: { coll: false } };
    expect(navKeys(viewer("sales"), overrides)).not.toContain("coll");
    expect(canOpenPage(viewer("sales"), "coll", overrides)).toBe(false);
    expect(canOpenPage(viewer("bd"), "coll", overrides)).toBe(true);
  });

  it("adds a page in the role's own order, or after the role's pages", () => {
    const overrides = { sales: { mof: true, drep: true, srep: true } };
    const keys = navKeys(viewer("sales"), overrides);
    expect(keys.slice(4, 7)).toEqual(["proj", "mof", "site"]);
    expect(keys.slice(-2)).toEqual(["srep", "drep"]);
    expect(navPagesFor(viewer("sales"), overrides)).toContainEqual(
      expect.objectContaining({ key: "mof", label: "My Sales" }),
    );
  });

  it("treats a salesperson who arranges stock as their own column", () => {
    const overrides = { arrange: { mof: true } };
    expect(canOpenPage(viewer("sales"), "mof", overrides)).toBe(false);
    expect(
      canOpenPage(viewer("sales", { arrangesStock: true }), "mof", overrides),
    ).toBe(true);
  });

  it("always allows the MD", () => {
    const overrides = { md: { coll: false, margin: false } };
    expect(canOpenPage(viewer("md"), "coll", overrides)).toBe(true);
    expect(accessAllowed("md", "margin", overrides)).toBe(true);
    expect(canSeeMargin(viewer("md"), overrides)).toBe(true);
  });
});

describe("margin", () => {
  it("defaults to the MD, HR & Accounts and Purchasing", () => {
    expect(defaultAllowed("accounts", "margin")).toBe(true);
    expect(defaultAllowed("support", "margin")).toBe(true);
    expect(defaultAllowed("director", "margin")).toBe(false);
    expect(defaultAllowed("sales", "margin")).toBe(false);
  });

  it("follows the role's override", () => {
    expect(
      canSeeMargin(viewer("director"), { director: { margin: true } }),
    ).toBe(true);
    expect(
      canSeeMargin(viewer("support"), { support: { margin: false } }),
    ).toBe(false);
  });

  it("is given to one person by their own tick", () => {
    expect(canSeeMargin(viewer("sales", { seesMargin: true }), {})).toBe(true);
  });
});

describe("defaultAllowed", () => {
  it("shows Tools & Forms to every role", () => {
    expect(defaultAllowed("designer", "tools")).toBe(true);
  });

  it("applies the demo's ACCESS0", () => {
    expect(defaultAllowed("sales", "mof")).toBe(false);
    expect(defaultAllowed("director", "mof")).toBe(false);
    expect(defaultAllowed("site", "cost")).toBe(false);
    expect(defaultAllowed("support", "cost")).toBe(true);
  });
});
