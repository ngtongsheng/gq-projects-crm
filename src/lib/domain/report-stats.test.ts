import { describe, expect, it } from "vitest";
import {
  achievedTone,
  bdStats,
  canReviewReport,
  isLate,
  monthPace,
  ReportStats,
  ReportTargets,
  reportDueAt,
  reportFlag,
  reportKindFor,
  type SalesInput,
  salesStats,
  siteStats,
} from "./report-stats";

const ME = "me";
const OTHER = "other";
const NOV = "2026-11-01";
const targets = ReportTargets.parse({});

const sales = (input: Partial<SalesInput> = {}): SalesInput => ({
  personId: ME,
  month: NOV,
  visits: [],
  projects: [],
  orders: [],
  targets,
  ...input,
});

describe("sales figures", () => {
  it("counts this month's visits by the person against the target", () => {
    const stats = salesStats(
      sales({
        visits: [
          { contactId: "a", ownerId: ME, day: "2026-11-03" },
          { contactId: "b", ownerId: ME, day: "2026-11-30" },
          { contactId: "a", ownerId: ME, day: "2026-10-31" },
          { contactId: "c", ownerId: OTHER, day: "2026-11-05" },
        ],
      }),
    );
    expect(stats).toMatchObject({ visits: 2, visitTarget: 50 });
  });

  it("counts a new customer only when this person met them first, this month", () => {
    const stats = salesStats(
      sales({
        visits: [
          // a: first met by me in November
          { contactId: "a", ownerId: ME, day: "2026-11-03" },
          // b: met before November
          { contactId: "b", ownerId: ME, day: "2026-10-20" },
          { contactId: "b", ownerId: ME, day: "2026-11-04" },
          // c: someone else met them first
          { contactId: "c", ownerId: OTHER, day: "2026-11-02" },
          { contactId: "c", ownerId: ME, day: "2026-11-09" },
        ],
      }),
    );
    expect(stats).toMatchObject({ newCustomers: 1 });
  });

  it("counts quotations and awarded orders for the month", () => {
    const stats = salesStats(
      sales({
        projects: [
          { picId: ME, stage: "quotation_sent", createdOn: "2026-11-02" },
          { picId: ME, stage: "awarded", createdOn: "2026-11-20" },
          { picId: ME, stage: "lead", createdOn: "2026-11-02" },
          { picId: ME, stage: "negotiation", createdOn: "2026-10-30" },
          { picId: OTHER, stage: "quotation_sent", createdOn: "2026-11-02" },
        ],
        orders: [
          {
            salespersonId: ME,
            passedBy: null,
            loaDate: "2026-11-10",
            contractSum: 1000.1,
            voAmount: 0.2,
          },
          {
            salespersonId: ME,
            passedBy: null,
            loaDate: "2026-11-30",
            contractSum: 500,
            voAmount: -100,
          },
          {
            salespersonId: ME,
            passedBy: null,
            loaDate: "2026-12-01",
            contractSum: 9000,
            voAmount: 0,
          },
        ],
      }),
    );
    expect(stats).toMatchObject({
      quotations: 2,
      awardedCount: 2,
      awardedValue: 1400.3,
    });
  });

  it("adds orders awarded on projects the BD Director passed down to someone else", () => {
    const stats = bdStats(
      sales({
        orders: [
          {
            salespersonId: OTHER,
            passedBy: ME,
            loaDate: "2026-11-10",
            contractSum: 2000,
            voAmount: 0,
          },
          {
            salespersonId: ME,
            passedBy: ME,
            loaDate: "2026-11-11",
            contractSum: 300,
            voAmount: 0,
          },
          {
            salespersonId: OTHER,
            passedBy: ME,
            loaDate: "2026-10-31",
            contractSum: 700,
            voAmount: 0,
          },
        ],
      }),
    );
    expect(stats).toMatchObject({
      kind: "bd",
      awardedValue: 300,
      passDownCount: 1,
      passDownValue: 2000,
    });
  });
});

describe("site figures", () => {
  const log = (
    visitedOn: string,
    mofId: string,
    activity: string,
    handoverSigned = false,
    supervisorId = ME,
  ) => ({ supervisorId, mofId, visitedOn, activity, handoverSigned });

  it("counts one visit per site per day, shootings, signed handovers and OT hours", () => {
    const stats = siteStats({
      personId: ME,
      month: NOV,
      targets,
      siteLogs: [
        log("2026-11-03", "m1", "measurement"),
        log("2026-11-03", "m1", "shooting"),
        log("2026-11-03", "m2", "handover", true),
        log("2026-11-04", "m1", "handover", false),
        log("2026-10-30", "m1", "shooting"),
        log("2026-11-05", "m3", "shooting", false, OTHER),
      ],
      otClaims: [
        {
          profileId: ME,
          workDate: "2026-11-03",
          hours: 2.5,
          status: "pending",
        },
        {
          profileId: ME,
          workDate: "2026-11-04",
          hours: 0.1,
          status: "approved",
        },
        { profileId: ME, workDate: "2026-11-05", hours: 4, status: "rejected" },
        {
          profileId: OTHER,
          workDate: "2026-11-05",
          hours: 3,
          status: "approved",
        },
      ],
    });
    expect(stats).toEqual({
      kind: "site",
      siteVisits: 3,
      siteVisitTarget: 50,
      shootings: 1,
      shootingTarget: 5,
      handovers: 1,
      handoverTarget: 5,
      otHours: 2.6,
    });
  });
});

describe("due and late", () => {
  // November 2026 is due Monday 7 December 2026, 9:00 AM Malaysia time (01:00 UTC).
  it("is due the first Monday of the next month at the due time, Malaysia time", () => {
    expect(reportDueAt(NOV, "09:00").toISOString()).toBe(
      "2026-12-07T01:00:00.000Z",
    );
    // December is due in the next year; 4 January 2027 is a Monday.
    expect(reportDueAt("2026-12-01", "09:00").toISOString()).toBe(
      "2027-01-04T01:00:00.000Z",
    );
  });

  it("is on time up to the due minute and late after it", () => {
    expect(isLate(NOV, "09:00", new Date("2026-12-07T01:00:00Z"))).toBe(false);
    expect(isLate(NOV, "09:00", new Date("2026-12-07T01:00:01Z"))).toBe(true);
    expect(isLate(NOV, "17:30", new Date("2026-12-07T09:29:00Z"))).toBe(false);
  });

  const flag = (input: Partial<Parameters<typeof reportFlag>[0]>) =>
    reportFlag({
      month: NOV,
      dueTime: "09:00",
      status: null,
      submittedAt: null,
      now: new Date("2026-11-20T00:00:00Z"),
      ...input,
    });

  it("flags drafts overdue once the due time passes", () => {
    expect(flag({ status: "draft" }).label).toBe("Draft");
    expect(flag({}).label).toBe("Not started");
    expect(flag({ now: new Date("2026-12-07T01:00:00Z") }).label).toBe(
      "Not started",
    );
    expect(
      flag({ status: "draft", now: new Date("2026-12-07T01:01:00Z") }),
    ).toEqual({ label: "Overdue", tone: "bad" });
  });

  it("keeps a late submission flagged after review", () => {
    const late = new Date("2026-12-08T02:00:00Z");
    expect(flag({ status: "submitted", submittedAt: late })).toEqual({
      label: "Submitted late",
      tone: "warn",
    });
    expect(flag({ status: "reviewed", submittedAt: late }).label).toBe(
      "Reviewed · submitted late",
    );
    expect(
      flag({ status: "reviewed", submittedAt: new Date("2026-12-01T00:00Z") }),
    ).toEqual({ label: "Reviewed", tone: "good" });
  });
});

describe("who files and who reviews", () => {
  it("gives salespeople, the BD Director and Site Supervisors their own report", () => {
    expect(reportKindFor("sales")).toBe("sales");
    expect(reportKindFor("bd")).toBe("bd");
    expect(reportKindFor("site")).toBe("site");
    expect(reportKindFor("md")).toBeNull();
    expect(reportKindFor("accounts")).toBeNull();
  });

  it("lets only the MD review the BD Director's report", () => {
    expect(canReviewReport("md", "sales")).toBe(true);
    expect(canReviewReport("director", "site")).toBe(true);
    expect(canReviewReport("accounts", "sales")).toBe(false);
    expect(canReviewReport("md", "bd")).toBe(true);
    expect(canReviewReport("director", "bd")).toBe(false);
  });
});

describe("targets and pace", () => {
  it("falls back to the default targets for missing or bad settings", () => {
    expect(ReportTargets.parse({ salesVisits: 40, shootings: "x" })).toEqual({
      salesVisits: 40,
      siteVisits: 50,
      shootings: 5,
      handovers: 5,
    });
  });

  it("colours achievement against where you should be by now", () => {
    expect(monthPace("2026-10-01", "2026-11-02")).toBe(1);
    expect(monthPace("2026-12-01", "2026-11-02")).toBe(0);
    expect(achievedTone(45, 50, 1)).toBe("good");
    expect(achievedTone(35, 50, 1)).toBe("warn");
    expect(achievedTone(34, 50, 1)).toBe("bad");
    expect(achievedTone(10, 50, 0.2)).toBe("good");
    expect(achievedTone(0, 0, 1)).toBe("neutral");
  });

  it("rejects a stored snapshot of the wrong shape", () => {
    expect(ReportStats.safeParse({ kind: "site", visits: 1 }).success).toBe(
      false,
    );
  });
});
