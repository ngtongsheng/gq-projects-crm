import { describe, expect, it } from "vitest";
import { canFileClaim, canManageClaims } from "./claim-eligibility";

describe("claim eligibility", () => {
  it("lets the field and sales roles file, not the MD or HR & Accounts", () => {
    for (const jobRole of ["sales", "bd", "director", "site"] as const) {
      expect(canFileClaim({ jobRole, sells: false })).toBe(true);
    }
    for (const jobRole of ["md", "accounts", "designer", "ssup"] as const) {
      expect(canFileClaim({ jobRole, sells: false })).toBe(false);
    }
  });

  it("lets only the MD and HR & Accounts settle claims", () => {
    expect(canManageClaims("md")).toBe(true);
    expect(canManageClaims("accounts")).toBe(true);
    for (const jobRole of ["sales", "bd", "director", "site"] as const) {
      expect(canManageClaims(jobRole)).toBe(false);
    }
  });
});
