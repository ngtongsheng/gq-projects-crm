import { describe, expect, it } from "vitest";
import { canClaimCommission, canFileClaim } from "./claim-eligibility";

describe("claim eligibility", () => {
  it("lets sales and the Marketing Director claim commission, and a selling Site Supervisor", () => {
    expect(canClaimCommission({ jobRole: "sales", sells: false })).toBe(true);
    expect(canClaimCommission({ jobRole: "bd", sells: false })).toBe(true);
    expect(canClaimCommission({ jobRole: "site", sells: true })).toBe(true);
    expect(canClaimCommission({ jobRole: "site", sells: false })).toBe(false);
    expect(canClaimCommission({ jobRole: "director", sells: false })).toBe(
      false,
    );
  });

  it("lets the field and sales roles file, not the MD or HR & Accounts", () => {
    for (const jobRole of ["sales", "bd", "director", "site"] as const) {
      expect(canFileClaim({ jobRole, sells: false })).toBe(true);
    }
    for (const jobRole of ["md", "accounts", "designer", "ssup"] as const) {
      expect(canFileClaim({ jobRole, sells: false })).toBe(false);
    }
  });
});
