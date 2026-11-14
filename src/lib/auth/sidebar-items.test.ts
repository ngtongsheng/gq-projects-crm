import { describe, expect, it } from "vitest";
import type { Language } from "@/lib/i18n/dictionary";
import type { JobRole } from "./job-role";
import type { Viewer } from "./pages";
import { sidebarItemsFor } from "./sidebar-items";

const viewer = (jobRole: JobRole): Viewer => ({
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
});

const outline = (
  jobRole: JobRole,
  isAdmin = false,
  language: Language = "en",
) => {
  const { main, after } = sidebarItemsFor({
    viewer: viewer(jobRole),
    isAdmin,
    overrides: {},
    language,
  });
  return {
    main: main.map((item) => item.label),
    after: after.map((item) => item.label),
  };
};

// Read from the demo's sidebar (docs/mockup/gqp-office-demo.html, Chrome, 2026-11-14) signed in
// as Vicky, Eddie, Vernice, Awal, Wai Mun and Affifa, keeping the pages built so far. The demo
// also lists Costing, Log work, HR, Sales Performance, Tasks, Tools & Forms and Leave, which are
// hidden until their pages exist.
describe("sidebarItemsFor: matches the demo's sidebar order, divider and Guide", () => {
  it("md", () => {
    expect(outline("md", true)).toEqual({
      main: [
        "Dashboard",
        "Sales Calendar",
        "Installation",
        "Customers",
        "Projects",
        "MOF Register",
        "Site Work",
        "Stock",
        "Collection",
        "Commission",
        "Claims",
        "Team Reports",
        "Director Report",
      ],
      after: ["Guide", "Sales Performance", "People"],
    });
  });

  it("director", () => {
    expect(outline("director")).toEqual({
      main: [
        "Dashboard",
        "Sales Calendar",
        "Installation",
        "Customers",
        "Projects",
        "Site Work",
        "Stock",
        "Collection",
        "Commission",
        "Claims",
        "Team Reports",
        "Director Report",
      ],
      after: ["Guide"],
    });
  });

  it("sales", () => {
    expect(outline("sales")).toEqual({
      main: [
        "Dashboard",
        "Sales Calendar",
        "Installation",
        "Customers",
        "Projects",
        "Site Work",
        "Stock",
        "Collection",
        "Commission",
        "My claims",
        "My Report",
      ],
      after: ["Guide"],
    });
  });

  it("site", () => {
    expect(outline("site")).toEqual({
      main: ["My schedule", "Site Work", "My Report", "My claims"],
      after: ["Guide"],
    });
  });

  // The demo's site supervisor with BM selected: tr() turns Log work, My schedule, Site Work and My
  // Report into Bahasa Malaysia; the other labels have no BM in the demo's TT and stay English.
  it("site in Bahasa Malaysia", () => {
    expect(outline("site", false, "bm")).toEqual({
      main: ["Jadual saya", "Kerja tapak", "Laporan saya", "My claims"],
      after: ["Guide"],
    });
  });

  it("keeps the English labels when a language has no translation", () => {
    expect(outline("md", true, "zh").main).toContain("Dashboard");
  });

  it("support", () => {
    expect(outline("support")).toEqual({
      main: [
        "Dashboard",
        "MOF Register",
        "Delivery & Installation",
        "Site Work",
        "Stock",
      ],
      after: ["Guide"],
    });
  });

  it("designer", () => {
    expect(outline("designer")).toEqual({
      main: ["Dashboard"],
      after: ["Guide"],
    });
  });
});

describe("sidebarItemsFor: badges and admin links", () => {
  it("puts a badge count on the page it is fed for", () => {
    const { main } = sidebarItemsFor({
      viewer: viewer("md"),
      isAdmin: true,
      overrides: {},
      badges: { dash: 3 },
    });
    expect(main.find((item) => item.key === "dash")?.badge).toBe(3);
    expect(main.find((item) => item.key === "cal")?.badge).toBeUndefined();
  });

  it("drops a badge for a page the person cannot open", () => {
    const { main } = sidebarItemsFor({
      viewer: viewer("site"),
      isAdmin: false,
      overrides: {},
      badges: { dash: 3 },
    });
    expect(main.some((item) => item.badge)).toBe(false);
  });

  it("gives People and Sales Performance only to admins", () => {
    expect(outline("md", true).after).toContain("People");
    expect(outline("md", false).after).not.toContain("People");
  });
});
