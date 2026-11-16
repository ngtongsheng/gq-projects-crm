import { describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import {
  type ClaimStatus,
  canAdjustClaim,
  canManageClaims,
  canTakeStep,
  flagRemarkBlock,
  payReportBlock,
  receiptsBlock,
  stepsFor,
  submitReportBlock,
  submittedAfterCutOff,
} from "./claim-flow";

const OWNER = "owner";
const viewer = (jobRole: JobRole, id = "someone-else") => ({ id, jobRole });
const claim = (status: ClaimStatus) => ({ profileId: OWNER, status });

describe("who takes which step", () => {
  it("the person submits their own draft or returned claim, nothing after", () => {
    const me = viewer("sales", OWNER);
    expect(stepsFor(me, claim("draft"))).toEqual(["submit"]);
    expect(stepsFor(me, claim("returned"))).toEqual(["submit"]);
    for (const status of ["submitted", "checked", "approved", "paid"] as const)
      expect(stepsFor(me, claim(status))).toEqual([]);
  });

  it("nobody submits someone else's claim", () => {
    expect(canTakeStep("submit", viewer("md"), claim("draft"))).toBe(false);
  });

  it("HR & Accounts checks, approves or returns a submitted claim", () => {
    expect(stepsFor(viewer("accounts"), claim("submitted"))).toEqual([
      "check",
      "approve",
      "return",
    ]);
  });

  it("the MD approves or returns a submitted or checked claim, but never checks", () => {
    expect(stepsFor(viewer("md"), claim("submitted"))).toEqual([
      "approve",
      "return",
    ]);
    expect(stepsFor(viewer("md"), claim("checked"))).toEqual([
      "approve",
      "return",
    ]);
  });

  it("only HR & Accounts marks an approved claim paid", () => {
    expect(stepsFor(viewer("accounts"), claim("approved"))).toEqual(["pay"]);
    expect(stepsFor(viewer("md"), claim("approved"))).toEqual([]);
  });

  it("other roles take no step on someone else's claim", () => {
    for (const jobRole of ["director", "sales", "bd", "site"] as const)
      for (const status of ["submitted", "checked", "approved"] as const)
        expect(stepsFor(viewer(jobRole), claim(status))).toEqual([]);
  });

  it("an approver cannot approve, check or pay their own claim", () => {
    for (const jobRole of ["md", "accounts"] as const) {
      const me = viewer(jobRole, OWNER);
      expect(canTakeStep("approve", me, claim("submitted"))).toBe(false);
      expect(canTakeStep("check", me, claim("submitted"))).toBe(false);
      expect(canTakeStep("return", me, claim("checked"))).toBe(false);
      expect(canTakeStep("pay", me, claim("approved"))).toBe(false);
    }
  });

  it("an approved or paid claim cannot be returned", () => {
    expect(canTakeStep("return", viewer("md"), claim("approved"))).toBe(false);
    expect(canTakeStep("return", viewer("accounts"), claim("paid"))).toBe(
      false,
    );
  });
});

describe("original receipts", () => {
  const block = (
    step: "check" | "approve",
    jobRole: JobRole,
    originalReceiptsReceived: boolean,
    receiptCount = 2,
  ) => receiptsBlock({ step, jobRole, receiptCount, originalReceiptsReceived });

  it("HR & Accounts must have them before checking or approving", () => {
    expect(block("check", "accounts", false)).toMatch(/Original receipts/);
    expect(block("approve", "accounts", false)).toMatch(/Original receipts/);
    expect(block("check", "accounts", true)).toBeNull();
  });

  it("the MD approves without them", () => {
    expect(block("approve", "md", false)).toBeNull();
  });

  it("are not needed when no line has a receipt", () => {
    expect(block("check", "accounts", false, 0)).toBeNull();
  });
});

describe("report gate on submit (needRep)", () => {
  const gate = (overrides: Partial<Parameters<typeof submitReportBlock>[0]>) =>
    submitReportBlock({
      needReport: true,
      claimMonth: "2026-11-01",
      reportKind: "sales",
      joinedOn: "2024-01-15",
      lastMonthReport: null,
      ...overrides,
    });

  it("blocks without last month's report, naming the month", () => {
    expect(gate({})).toBe("Please submit your Oct 2026 monthly report first.");
    expect(gate({ lastMonthReport: "draft" })).toMatch(/Oct 2026/);
  });

  it("lets a submitted, reviewed or approved report through", () => {
    for (const status of ["submitted", "reviewed", "approved"] as const)
      expect(gate({ lastMonthReport: status })).toBeNull();
  });

  it("looks at December for a January claim", () => {
    expect(gate({ claimMonth: "2027-01-01" })).toMatch(/Dec 2026/);
  });

  it("does not hold someone who files no report", () => {
    expect(gate({ reportKind: null })).toBeNull();
  });

  it("does not hold someone who joined after last month", () => {
    expect(gate({ joinedOn: "2026-11-03" })).toBeNull();
    expect(gate({ joinedOn: "2026-10-31" })).toMatch(/Oct 2026/);
  });

  it("is off when the setting is off", () => {
    expect(gate({ needReport: false })).toBeNull();
  });
});

describe("report gate on payment (clRepOk)", () => {
  const gate = (
    claimMonthReport: Parameters<typeof payReportBlock>[0]["claimMonthReport"],
    reportKind: Parameters<typeof payReportBlock>[0]["reportKind"] = "site",
  ) =>
    payReportBlock({ claimMonth: "2026-11-01", reportKind, claimMonthReport });

  it("holds payment until the claim month's report has the MD's approval", () => {
    for (const status of [null, "draft", "submitted", "reviewed"] as const)
      expect(gate(status)).toMatch(/Nov 2026 monthly report is approved/);
    expect(gate("approved")).toBeNull();
  });

  it("does not hold someone who files no report", () => {
    expect(gate(null, null)).toBeNull();
  });
});

describe("submitted after the cut-off", () => {
  it("is late only after the claim month's cut-off day", () => {
    expect(submittedAfterCutOff("2026-11-01", 25, "2026-11-25")).toBe(false);
    expect(submittedAfterCutOff("2026-11-01", 25, "2026-11-26")).toBe(true);
    expect(submittedAfterCutOff("2026-12-01", 25, "2026-11-30")).toBe(false);
  });
});

describe("who adjusts a claim", () => {
  it("the MD and HR & Accounts manage claims, nobody else", () => {
    expect(canManageClaims("md")).toBe(true);
    expect(canManageClaims("accounts")).toBe(true);
    expect(canManageClaims("director")).toBe(false);
    expect(canManageClaims("sales")).toBe(false);
  });

  it("is open to them on someone else's claim while it is submitted or checked", () => {
    for (const jobRole of ["md", "accounts"] as const) {
      for (const status of ["submitted", "checked"] as const)
        expect(canAdjustClaim(viewer(jobRole), claim(status))).toBe(true);
      for (const status of ["draft", "returned", "approved", "paid"] as const)
        expect(canAdjustClaim(viewer(jobRole), claim(status))).toBe(false);
    }
  });

  it("is closed to their own claim and to other roles", () => {
    expect(canAdjustClaim(viewer("accounts", OWNER), claim("submitted"))).toBe(
      false,
    );
    expect(canAdjustClaim(viewer("director"), claim("submitted"))).toBe(false);
  });
});

describe("remark on a flagged claim", () => {
  it("blocks checking or approving a flagged claim without a remark", () => {
    for (const step of ["check", "approve"] as const)
      expect(flagRemarkBlock({ step, flagCount: 2, remark: "  " })).toMatch(
        /Write in the remark/,
      );
  });

  it("lets it through with a remark, no flags, or any other step", () => {
    expect(
      flagRemarkBlock({ step: "check", flagCount: 2, remark: "Justified" }),
    ).toBeNull();
    expect(
      flagRemarkBlock({ step: "approve", flagCount: 0, remark: "" }),
    ).toBeNull();
    expect(
      flagRemarkBlock({ step: "return", flagCount: 2, remark: "" }),
    ).toBeNull();
    expect(
      flagRemarkBlock({ step: "pay", flagCount: 2, remark: "" }),
    ).toBeNull();
  });
});
