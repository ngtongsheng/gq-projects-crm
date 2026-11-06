import { describe, expect, it } from "vitest";
import { searchSites, splitToday } from "./site-search";

const sites = [
  {
    id: "a",
    mofNo: "P1515",
    projectName: "AirAsia Move",
    companyName: "Hartamas Design Associates",
    siteAddress: "Sepang",
  },
  {
    id: "b",
    mofNo: "P1536",
    projectName: "Skynet Kuchai Lama",
    companyName: "Homa Engineering",
    siteAddress: "Kuchai Lama, KL",
  },
  {
    id: "c",
    mofNo: "P1601",
    projectName: "Level 3 Office",
    companyName: "Homa Engineering",
    siteAddress: "",
  },
];

describe("searchSites", () => {
  it("shows everything when nothing is typed", () => {
    expect(searchSites(sites, "")).toHaveLength(3);
    expect(searchSites(sites, "   ")).toHaveLength(3);
  });

  it("finds by MOF number, project, company or site, whatever the capitals", () => {
    expect(searchSites(sites, "p1536").map((s) => s.id)).toEqual(["b"]);
    expect(searchSites(sites, "AIRASIA").map((s) => s.id)).toEqual(["a"]);
    expect(searchSites(sites, "homa").map((s) => s.id)).toEqual(["b", "c"]);
    expect(searchSites(sites, "sepang").map((s) => s.id)).toEqual(["a"]);
  });

  it("needs every word, in any order", () => {
    expect(searchSites(sites, "homa kuchai").map((s) => s.id)).toEqual(["b"]);
    expect(searchSites(sites, "kuchai homa").map((s) => s.id)).toEqual(["b"]);
    expect(searchSites(sites, "homa airasia")).toEqual([]);
  });
});

describe("splitToday", () => {
  it("puts today's projects first and keeps the order of the rest", () => {
    const { today, others } = splitToday(sites, new Set(["c", "a"]));
    expect(today.map((s) => s.id)).toEqual(["a", "c"]);
    expect(others.map((s) => s.id)).toEqual(["b"]);
  });

  it("has nothing for today when nobody is scheduled", () => {
    const { today, others } = splitToday(sites, new Set());
    expect(today).toEqual([]);
    expect(others).toHaveLength(3);
  });
});
