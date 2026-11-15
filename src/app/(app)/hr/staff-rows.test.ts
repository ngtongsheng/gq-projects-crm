import { describe, expect, it } from "vitest";
import type {
  StaffPackage,
  StandardPackages,
} from "@/lib/domain/staff-package";
import { buildStaffRows } from "./staff-rows";

const standards: StandardPackages = {
  sales: { allowances: [], claimCap: 500 },
  site: { allowances: [], claimCap: null },
};
const outstation = {
  breakfast: 10,
  lunch: 15,
  dinner: 25,
  hotel: { staff: 100, manager: 150, director: 180 },
};
const ADA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";

const pkg = (
  profileId: string,
  effectiveOn: string,
  basic: number,
): StaffPackage => ({
  id: `${profileId}-${effectiveOn}`,
  profileId,
  effectiveOn,
  basic,
  allowances: [{ name: "car", amount: 300 }],
  claimCap: null,
  hotelLevel: null,
  reason: "",
  addedBy: BEN,
});

const build = (packages: StaffPackage[], grade: string | null = null) =>
  buildStaffRows({
    people: [
      { id: BEN, jobRole: "sales", joinedOn: "2024-02-01" },
      { id: ADA, jobRole: "sales", joinedOn: null },
    ],
    packages,
    records: new Map(
      grade
        ? [[ADA, { grade, confirmedOn: null, offerLetterLink: null, note: "" }]]
        : [],
    ),
    standards,
    outstation,
    nameOf: (id) => (id === ADA ? "Ada" : "Ben"),
    today: "2026-11-15",
  });

describe("buildStaffRows", () => {
  it("shows the package in force today, with a later change as next", () => {
    const { rows } = build([
      pkg(ADA, "2025-01-01", 3000),
      pkg(ADA, "2026-07-01", 3500),
      pkg(ADA, "2027-01-01", 4000),
    ]);
    const ada = rows.find((row) => row.name === "Ada");
    expect(ada?.current?.basic).toBe(3500);
    expect(ada?.next?.basic).toBe(4000);
    expect(ada?.changes).toBe(3);
    expect(ada?.sheet.history.map((entry) => entry.basic)).toEqual([
      4000, 3500, 3000,
    ]);
    expect(ada?.claimCap).toBe(500);
  });

  it("totals what is paid now and counts people without a package", () => {
    const result = build([
      pkg(ADA, "2026-07-01", 3500),
      pkg(BEN, "2027-01-01", 9000),
    ]);
    expect(result.monthlyTotal).toBe(3800);
    expect(result.withoutPackage).toBe(1);
  });

  it("reads the hotel level from the person's grade", () => {
    const { rows } = build([], "M1");
    expect(rows.find((row) => row.name === "Ada")?.sheet.autoHotelLevel).toBe(
      "manager",
    );
    expect(rows.find((row) => row.name === "Ben")?.sheet.autoHotelLevel).toBe(
      "staff",
    );
  });

  it("orders by position then name", () => {
    expect(build([]).rows.map((row) => row.name)).toEqual(["Ada", "Ben"]);
  });
});
