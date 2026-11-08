import { describe, expect, it } from "vitest";
import type { JobRole } from "./job-role";
import { canOpenSection, modulesFor, sectionsFor } from "./nav-sections";

const labels = (jobRole: JobRole) => sectionsFor(jobRole).map((s) => s.label);

// Lists copied from the prototype's tabsDef.
describe("sectionsFor", () => {
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
      "Guide",
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
      "Guide",
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
      "Guide",
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
      "Guide",
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
      "Guide",
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
      "Guide",
    ]);
  });
});

describe("sidebar per role", () => {
  it("lists the sections in sidebar order", () => {
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
      "reports",
      "guide",
    ]);
    expect(sectionsFor("bd").map((s) => s.key)).toContain("directorReport");
    expect(sectionsFor("bd").map((s) => s.key)).not.toContain("reports");
    expect(sectionsFor("site").map((s) => s.label)).toEqual([
      "Installation Calendar",
      "Site Work",
      "Overtime",
      "My Report",
      "Guide",
    ]);
  });
});

describe("report links", () => {
  const hrefOf = (jobRole: JobRole, key: string) =>
    sectionsFor(jobRole).find((s) => s.key === key)?.href;

  it("sends managers to Team Reports and others to their own report", () => {
    expect(hrefOf("md", "reports")).toBe("/reports/team");
    expect(hrefOf("accounts", "reports")).toBe("/reports/team");
    expect(hrefOf("sales", "reports")).toBe("/reports");
    expect(hrefOf("bd", "directorReport")).toBe("/reports/director");
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

describe("modulesFor", () => {
  const jobRoles: JobRole[] = [
    "md",
    "director",
    "bd",
    "sales",
    "accounts",
    "site",
    "support",
  ];

  it("gives every job role a CRM module with the same links as before", () => {
    for (const jobRole of jobRoles) {
      const modules = modulesFor(jobRole);
      expect(modules.map((m) => m.key)).toEqual(["crm"]);
      expect(modules[0]?.label).toBe("CRM");
      expect(modules[0]?.sections).toEqual(sectionsFor(jobRole));
    }
  });
});
