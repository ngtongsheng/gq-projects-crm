import { describe, expect, it } from "vitest";
import type { JobRole } from "./job-role";
import {
  allowedSectionsFor,
  canOpenSection,
  sectionsFor,
} from "./nav-sections";

const labels = (jobRole: JobRole) =>
  allowedSectionsFor(jobRole).map((s) => s.label);

// Lists copied from the prototype's tabsDef.
describe("allowedSectionsFor", () => {
  it("gives the MD every section, with manager wording", () => {
    expect(labels("md")).toEqual([
      "Dashboard",
      "Sales Calendar",
      "Installation",
      "Customers",
      "Projects",
      "MOF Register",
      "Site Work",
      "Overtime",
      "Stock",
      "Collection",
      "Commission",
      "Team Reports",
      "Director Report",
    ]);
  });

  it("leaves MOF out for the Sales Director", () => {
    expect(labels("director")).toEqual([
      "Dashboard",
      "Sales Calendar",
      "Installation",
      "Customers",
      "Projects",
      "Site Work",
      "Overtime",
      "Stock",
      "Collection",
      "Commission",
      "Team Reports",
      "Director Report",
    ]);
  });

  it("gives the BD Director My Sales, no personal report", () => {
    expect(labels("bd")).toEqual([
      "Dashboard",
      "Sales Calendar",
      "Installation",
      "Customers",
      "Projects",
      "My Sales",
      "Site Work",
      "Overtime",
      "Stock",
      "Collection",
      "Commission",
      "Director Report",
    ]);
  });

  it("gives sales My Sales and My Report, no Director Report", () => {
    expect(labels("sales")).toEqual([
      "Dashboard",
      "Sales Calendar",
      "Installation",
      "Customers",
      "Projects",
      "My Sales",
      "Site Work",
      "Overtime",
      "Stock",
      "Collection",
      "Commission",
      "My Report",
    ]);
  });

  it("gives HR & Accounts the manager view", () => {
    expect(labels("accounts")).toEqual(labels("md"));
  });

  it("gives the site supervisor four sections", () => {
    expect(labels("site")).toEqual([
      "Installation Calendar",
      "Site Work",
      "Overtime",
      "My Report",
    ]);
  });

  it("gives purchasing the support list", () => {
    expect(labels("support")).toEqual([
      "Dashboard",
      "Delivery & Installation",
      "MOF Register",
      "Site Work",
      "Overtime",
      "Stock",
    ]);
  });
});

describe("sectionsFor", () => {
  it("only lists sections that have a page", () => {
    expect(sectionsFor("sales").map((s) => s.key)).toEqual([
      "dashboard",
      "salesCalendar",
      "installation",
      "customers",
      "projects",
      "mof",
      "siteWork",
      "overtime",
      "stock",
      "collection",
      "commission",
    ]);
    expect(sectionsFor("site").map((s) => s.label)).toEqual([
      "Installation Calendar",
      "Site Work",
      "Overtime",
    ]);
  });
});

describe("canOpenSection", () => {
  it("blocks a hidden section", () => {
    expect(canOpenSection("site", "customers")).toBe(false);
    expect(canOpenSection("director", "mof")).toBe(false);
  });

  it("allows a visible section", () => {
    expect(canOpenSection("site", "siteWork")).toBe(true);
  });
});
