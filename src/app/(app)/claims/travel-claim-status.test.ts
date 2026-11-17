import { describe, expect, it } from "vitest";
import {
  filesMonthlyReport,
  reportAllowsRelease,
  travelClaimPill,
} from "./travel-claim-status";

describe("reportAllowsRelease", () => {
  it("waits for the same month's report from roles that file one", () => {
    for (const jobRole of ["sales", "bd", "site"] as const) {
      expect(reportAllowsRelease(jobRole, null)).toBe(false);
      expect(reportAllowsRelease(jobRole, "draft")).toBe(false);
      expect(reportAllowsRelease(jobRole, "submitted")).toBe(true);
      expect(reportAllowsRelease(jobRole, "approved")).toBe(true);
    }
  });

  it("does not wait for the Sales Director, who files no report", () => {
    expect(filesMonthlyReport("director")).toBe(false);
    expect(reportAllowsRelease("director", null)).toBe(true);
  });
});

describe("travelClaimPill", () => {
  const claim = (status: "draft" | "submitted" | "released") => ({
    status,
    releasedOn: status === "released" ? "2026-11-20" : null,
  });

  it("shows where the claim stands", () => {
    expect(travelClaimPill(null, true).label).toBe("Not submitted");
    expect(travelClaimPill(claim("draft"), true).label).toBe("Not submitted");
    expect(travelClaimPill(claim("submitted"), false).label).toBe(
      "Wait for report",
    );
    expect(travelClaimPill(claim("submitted"), true).label).toBe(
      "Ready to release",
    );
    expect(travelClaimPill(claim("released"), false)).toEqual({
      label: "Released",
      tone: "good",
      date: "2026-11-20",
    });
  });
});
