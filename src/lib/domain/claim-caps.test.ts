import { describe, expect, it } from "vitest";
import { type ClaimCapBasis, claimCapsOn } from "./claim-caps";
import type { StaffPackage } from "./staff-package";

const pkg = (
  effectiveOn: string,
  overrides: Partial<StaffPackage> = {},
): StaffPackage => ({
  id: effectiveOn,
  profileId: "p1",
  effectiveOn,
  basic: 3000,
  allowances: [],
  claimCap: null,
  hotelLevel: null,
  reason: "",
  addedBy: "p2",
  ...overrides,
});

const basis = (overrides: Partial<ClaimCapBasis> = {}): ClaimCapBasis => ({
  person: { jobRole: "sales", grade: null },
  packages: [],
  standards: {
    sales: { allowances: [], claimCap: 500 },
    site: { allowances: [], claimCap: 500 },
  },
  outstation: {
    breakfast: 10,
    lunch: 15,
    dinner: 25,
    hotel: { staff: 100, manager: 150, director: 180 },
  },
  ...overrides,
});

describe("claimCapsOn", () => {
  it("uses the package in force on the date", () => {
    const packages = [
      pkg("2026-01-01", { claimCap: 600 }),
      pkg("2026-12-01", { claimCap: 700, hotelLevel: "manager" }),
    ];
    expect(claimCapsOn(basis({ packages }), "2026-11-25")).toEqual({
      monthlyCap: 600,
      hotelBudget: 100,
    });
    expect(claimCapsOn(basis({ packages }), "2026-12-01")).toEqual({
      monthlyCap: 700,
      hotelBudget: 150,
    });
  });

  it("falls back to the position's standard cap", () => {
    expect(claimCapsOn(basis(), "2026-11-25").monthlyCap).toBe(500);
  });

  it("treats no cap and a cap of 0 as none", () => {
    const office = basis({ person: { jobRole: "accounts", grade: null } });
    expect(claimCapsOn(office, "2026-11-25").monthlyCap).toBeNull();
    const zero = basis({ packages: [pkg("2026-01-01", { claimCap: 0 })] });
    expect(claimCapsOn(zero, "2026-11-25").monthlyCap).toBeNull();
  });
});
