import { describe, expect, it } from "vitest";
import type { StaffPackage } from "@/lib/domain/staff-package";
import { buildGradeRows } from "./grades-rows";

const ADA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";
const CAL = "33333333-3333-4333-8333-333333333333";

const grades = [
  { grade: "S1", basic: 4000, annualTarget: 1440000, description: "x" },
  { grade: "S2", basic: null, annualTarget: 1800000, description: "y" },
];
const names: Record<string, string> = {
  [ADA]: "Ada",
  [BEN]: "Ben",
  [CAL]: "Cal",
};

const pkg = (basic: number): StaffPackage => ({
  id: "p1",
  profileId: ADA,
  effectiveOn: "2026-01-01",
  basic,
  allowances: [],
  claimCap: null,
  hotelLevel: null,
  reason: "",
  addedBy: BEN,
});

const build = (
  records: Map<
    string,
    {
      grade: string | null;
      appendixSignedOn: string | null;
      appendixVersion: string | null;
    }
  >,
  packages: StaffPackage[] = [],
) =>
  buildGradeRows({
    people: [
      { id: BEN, jobRole: "sales", joinedOn: null },
      { id: ADA, jobRole: "director", joinedOn: null },
      { id: CAL, jobRole: "site", joinedOn: null },
    ],
    packages,
    records,
    grades,
    schemeVersion: "2026-09-08",
    nameOf: (id) => names[id] ?? "?",
    today: "2026-11-15",
  });

describe("buildGradeRows", () => {
  it("lists salespeople and directors, and others only once they have a grade", () => {
    expect(build(new Map()).map((row) => row.name)).toEqual(["Ada", "Ben"]);
    const withSiteGrade = new Map([
      [CAL, { grade: "S1", appendixSignedOn: null, appendixVersion: null }],
    ]);
    expect(build(withSiteGrade).map((row) => row.name)).toContain("Cal");
  });

  it("takes basic from the person's package, else from the grade", () => {
    const records = new Map([
      [ADA, { grade: "S1", appendixSignedOn: null, appendixVersion: null }],
      [BEN, { grade: "S1", appendixSignedOn: null, appendixVersion: null }],
    ]);
    const rows = build(records, [pkg(5500)]);
    expect(rows.find((row) => row.name === "Ada")).toMatchObject({
      basic: 5500,
      basicFromPackage: true,
      gradeTarget: 1440000,
    });
    expect(rows.find((row) => row.name === "Ben")).toMatchObject({
      basic: 4000,
      basicFromPackage: false,
    });
  });

  it("has no basic or target without a grade, and flags an unsigned appendix", () => {
    expect(build(new Map())[0]).toMatchObject({
      grade: null,
      basic: null,
      gradeTarget: null,
      appendix: "not_signed",
    });
  });

  it("flags a signature on an older version of the scheme", () => {
    const records = new Map([
      [
        ADA,
        {
          grade: "S1",
          appendixSignedOn: "2025-02-01",
          appendixVersion: "2025-01-01",
        },
      ],
    ]);
    expect(build(records).find((row) => row.name === "Ada")?.appendix).toBe(
      "older_version",
    );
  });
});
