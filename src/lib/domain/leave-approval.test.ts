import { describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import {
  canCancelLeave,
  canConfirmOriginalSlip,
  canDecideLeave,
  canUploadSlip,
  decideLeave,
  type LeaveApprovalStep,
  type LeaveApprover,
  type LeaveRequestParties,
  leaveApprovers,
} from "./leave-approval";
import type { LeaveType } from "./leave-balance";

const ALI = { id: "ali", jobRole: "sales" as const };
const LEAD = { id: "eddie", jobRole: "director" as const };
const VICKY = { id: "vicky", jobRole: "md" as const };
const HR = { id: "hr", jobRole: "accounts" as const };
const DESIGNER = { id: "dee", jobRole: "designer" as const };

const chain = (approvers: LeaveApprover[]): LeaveApprovalStep[] =>
  approvers.map((approver, index) => ({
    ...approver,
    position: index + 1,
    decision: null,
  }));

function request(
  applicant: { id: string; jobRole: JobRole },
  extra: Partial<LeaveRequestParties> & { teamLeadId?: string | null } = {},
  type: LeaveType = "annual",
): LeaveRequestParties {
  const { teamLeadId = null, ...rest } = extra;
  return {
    personId: applicant.id,
    leaveType: type,
    status: "pending",
    startsOn: "2027-03-10",
    hasSlip: false,
    steps: chain(leaveApprovers({ jobRole: applicant.jobRole, teamLeadId })),
    ...rest,
  };
}

describe("leaveApprovers", () => {
  it("sends a salesperson to their team lead, then the MD", () => {
    expect(leaveApprovers({ jobRole: "sales", teamLeadId: "eddie" })).toEqual([
      { approverId: "eddie" },
      { approverRole: "md" },
    ]);
  });

  it("sends a salesperson without a team lead to the MD", () => {
    expect(leaveApprovers({ jobRole: "sales", teamLeadId: null })).toEqual([
      { approverRole: "md" },
    ]);
  });

  it.each(["bd", "site"] as const)(
    "sends %s to the Sales Director, then the MD",
    (jobRole) => {
      expect(leaveApprovers({ jobRole, teamLeadId: null })).toEqual([
        { approverRole: "director" },
        { approverRole: "md" },
      ]);
    },
  );

  it("sends the MD's own leave to the Sales Director", () => {
    expect(leaveApprovers({ jobRole: "md", teamLeadId: null })).toEqual([
      { approverRole: "director" },
    ]);
  });

  it.each([
    "director",
    "accounts",
    "support",
    "ssup",
    "marketing",
    "designer",
  ] as const)("sends %s to the MD", (jobRole) => {
    expect(leaveApprovers({ jobRole, teamLeadId: "eddie" })).toEqual([
      { approverRole: "md" },
    ]);
  });
});

describe("decideLeave", () => {
  it("walks a salesperson's leave through the team lead, then the MD", () => {
    const leave = request(ALI, { teamLeadId: LEAD.id });
    expect(canDecideLeave(leave, VICKY)).toBe(true);
    expect(canDecideLeave(leave, LEAD)).toBe(true);

    const first = decideLeave(leave, LEAD, true);
    expect(first).toMatchObject({ error: null, status: "pending" });
    if (first.error !== null) return;
    expect(first.steps.map((s) => s.decision)).toEqual(["approved", null]);

    const second = { ...leave, steps: first.steps };
    expect(canDecideLeave(second, LEAD)).toBe(false);
    expect(decideLeave(second, VICKY, true)).toMatchObject({
      status: "approved",
    });
  });

  it("lets the MD finish the whole chain in one go", () => {
    const result = decideLeave(
      request(ALI, { teamLeadId: LEAD.id }),
      VICKY,
      true,
    );
    expect(result).toMatchObject({ error: null, status: "approved" });
  });

  it("has the Sales Director decide the MD's leave", () => {
    const leave = request(VICKY);
    expect(decideLeave(leave, LEAD, true)).toMatchObject({
      status: "approved",
    });
    expect(canDecideLeave(leave, HR)).toBe(false);
  });

  it("sends Marketing Director leave to the Sales Director first", () => {
    const leave = request({ id: "van", jobRole: "bd" });
    const first = decideLeave(leave, LEAD, true);
    expect(first).toMatchObject({ error: null, status: "pending" });
    expect(canDecideLeave(leave, HR)).toBe(false);
  });

  it("has only the MD decide everyone else's leave", () => {
    const leave = request(DESIGNER);
    expect(canDecideLeave(leave, LEAD)).toBe(false);
    expect(decideLeave(leave, LEAD, true)).toEqual({
      error: "This leave is waiting for someone else.",
    });
    expect(decideLeave(leave, VICKY, true)).toMatchObject({
      status: "approved",
    });
  });

  it("refuses a decision on your own leave, even for the MD", () => {
    expect(canDecideLeave(request(VICKY), VICKY)).toBe(false);
    expect(decideLeave(request(VICKY), VICKY, false)).toEqual({
      error: "Nobody approves their own leave.",
    });
  });

  it("refuses to approve an MC or hospitalisation without the slip", () => {
    for (const type of ["mc", "hospitalisation"] as const) {
      expect(decideLeave(request(DESIGNER, {}, type), VICKY, true)).toEqual({
        error: "Upload the slip before the leave is approved.",
      });
    }
  });

  it("still lets an MC without a slip be rejected", () => {
    expect(
      decideLeave(request(DESIGNER, {}, "mc"), VICKY, false),
    ).toMatchObject({ error: null, status: "rejected" });
  });

  it("lets HR & Accounts approve every step of an MC with a slip", () => {
    const leave = request(ALI, { teamLeadId: LEAD.id, hasSlip: true }, "mc");
    expect(canDecideLeave(leave, HR)).toBe(true);
    expect(decideLeave(leave, HR, true)).toMatchObject({ status: "approved" });
    expect(canDecideLeave(request(ALI, { teamLeadId: LEAD.id }), HR)).toBe(
      false,
    );
  });

  it("stops the chain at a rejection", () => {
    const leave = request(ALI, { teamLeadId: LEAD.id });
    const result = decideLeave(leave, LEAD, false);
    expect(result).toMatchObject({ error: null, status: "rejected" });
    if (result.error !== null) return;
    expect(result.steps.map((s) => s.decision)).toEqual(["rejected", null]);

    const rejected = { ...leave, steps: result.steps, status: result.status };
    expect(canDecideLeave(rejected, VICKY)).toBe(false);
    expect(decideLeave(rejected, VICKY, true)).toEqual({
      error: "This leave is not waiting for approval.",
    });
  });

  it("lets the MD reject in one step without deciding the rest", () => {
    const result = decideLeave(
      request(ALI, { teamLeadId: LEAD.id }),
      VICKY,
      false,
    );
    expect(result).toMatchObject({ status: "rejected" });
    if (result.error !== null) return;
    expect(result.steps.map((s) => s.decision)).toEqual(["rejected", null]);
  });
});

describe("canCancelLeave", () => {
  const today = "2027-03-09";

  it("lets the person cancel pending leave, even once it started", () => {
    expect(
      canCancelLeave(request(ALI, { startsOn: "2027-03-01" }), ALI, today),
    ).toBe(true);
  });

  it("lets the person cancel approved leave only before it starts", () => {
    const approved = request(ALI, { status: "approved" });
    expect(canCancelLeave(approved, ALI, today)).toBe(true);
    expect(canCancelLeave(approved, ALI, "2027-03-10")).toBe(false);
  });

  it("refuses someone else's leave and closed leave", () => {
    expect(canCancelLeave(request(ALI), VICKY, today)).toBe(false);
    expect(
      canCancelLeave(request(ALI, { status: "rejected" }), ALI, today),
    ).toBe(false);
  });
});

describe("slips", () => {
  const mc = request(ALI, {}, "mc");

  it("lets the person, the MD and HR & Accounts upload an MC slip", () => {
    expect(canUploadSlip(mc, ALI)).toBe(true);
    expect(canUploadSlip(mc, VICKY)).toBe(true);
    expect(canUploadSlip(mc, HR)).toBe(true);
    expect(canUploadSlip(mc, LEAD)).toBe(false);
  });

  it("takes no slip on annual leave or closed leave", () => {
    expect(canUploadSlip(request(ALI), ALI)).toBe(false);
    expect(canUploadSlip({ ...mc, status: "cancelled" }, ALI)).toBe(false);
  });

  it("lets only the MD and HR & Accounts tick the original, once uploaded", () => {
    const withSlip = { ...mc, hasSlip: true };
    expect(canConfirmOriginalSlip(withSlip, HR)).toBe(true);
    expect(canConfirmOriginalSlip(withSlip, VICKY)).toBe(true);
    expect(canConfirmOriginalSlip(withSlip, ALI)).toBe(false);
    expect(canConfirmOriginalSlip(mc, HR)).toBe(false);
  });
});
