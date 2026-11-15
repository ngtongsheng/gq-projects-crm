import { describe, expect, it } from "vitest";
import { parseSiteView, siteViewsFor } from "./site-view";

const person = (jobRole: Parameters<typeof siteViewsFor>[0]["jobRole"]) => ({
  jobRole,
  arrangesStock: false,
});

describe("siteViewsFor", () => {
  it("shows marketing only Photos and Site log, photos first", () => {
    expect(siteViewsFor(person("marketing"))).toEqual(["shots", "log"]);
  });

  it("shows managers and the support team all seven tabs", () => {
    for (const jobRole of ["md", "director", "accounts", "support"] as const) {
      expect(siteViewsFor(person(jobRole))).toHaveLength(7);
    }
    expect(
      siteViewsFor({ jobRole: "sales", arrangesStock: true }),
    ).toHaveLength(7);
  });

  it("keeps the reminder settings from site supervisors and salespeople", () => {
    for (const jobRole of ["site", "sales", "bd"] as const) {
      expect(siteViewsFor(person(jobRole))).toEqual([
        "jobs",
        "log",
        "meas",
        "shots",
        "actions",
        "returns",
      ]);
    }
  });
});

describe("parseSiteView", () => {
  const views = siteViewsFor(person("marketing"));

  it("opens the first tab when none or an unknown one is asked for", () => {
    expect(parseSiteView(undefined, views)).toBe("shots");
    expect(parseSiteView("nope", views)).toBe("shots");
  });

  it("sends a hidden tab back to the first one", () => {
    expect(parseSiteView("jobs", views)).toBe("shots");
  });

  it("opens a tab the person sees", () => {
    expect(parseSiteView("log", views)).toBe("log");
  });
});
