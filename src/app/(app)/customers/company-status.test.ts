import { describe, expect, it } from "vitest";
import { companyStatus, companyStatusLabel } from "./company-status";

const TODAY = "2026-11-15";

describe("companyStatus", () => {
  it("is none when the company was never visited", () => {
    expect(companyStatus(null, TODAY)).toEqual({ kind: "none" });
  });

  it("is active up to and including 60 days", () => {
    expect(companyStatus("2026-11-15", TODAY)).toEqual({
      kind: "active",
      idleDays: 0,
    });
    expect(companyStatus("2026-09-16", TODAY)).toEqual({
      kind: "active",
      idleDays: 60,
    });
  });

  it("is quiet from 61 to 90 days", () => {
    expect(companyStatus("2026-09-15", TODAY)).toEqual({
      kind: "quiet",
      idleDays: 61,
    });
    expect(companyStatus("2026-08-17", TODAY)).toEqual({
      kind: "quiet",
      idleDays: 90,
    });
  });

  it("is no visit from 91 days", () => {
    expect(companyStatus("2026-08-16", TODAY)).toEqual({
      kind: "no_visit",
      idleDays: 91,
    });
  });

  it("labels the status as the list shows it", () => {
    expect(companyStatusLabel(companyStatus(null, TODAY))).toBe("No visit yet");
    expect(companyStatusLabel(companyStatus("2026-11-01", TODAY))).toBe(
      "Active",
    );
    expect(companyStatusLabel(companyStatus("2026-09-15", TODAY))).toBe(
      "Quiet 61d",
    );
    expect(companyStatusLabel(companyStatus("2026-08-16", TODAY))).toBe(
      "No visit 91d",
    );
  });
});
