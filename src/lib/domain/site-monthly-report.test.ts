import { describe, expect, it } from "vitest";
import {
  buildSiteMonthlyReport,
  dayName,
  type ItineraryLog,
  type OvertimeLine,
} from "./site-monthly-report";

const log = (
  visitedOn: string,
  mofNo: string,
  activity: ItineraryLog["activity"],
  extra: Partial<ItineraryLog> = {},
): ItineraryLog => ({
  visitedOn,
  mofNo,
  projectName: `Site ${mofNo}`,
  activity,
  notes: null,
  handoverSigned: false,
  ...extra,
});

const claim = (
  workDate: string,
  hours: number,
  extra: Partial<OvertimeLine> = {},
): OvertimeLine => ({
  workDate,
  mofNo: "P1500",
  projectName: "Night work site",
  reason: "Client asked for after hours",
  fromTime: "20:00",
  toTime: "22:00",
  hours,
  status: "approved",
  approvedBy: "Vicky",
  ...extra,
});

const logs = [
  log("2026-10-12", "P1502", "installation", { notes: "Lobby done" }),
  log("2026-10-05", "P1500", "measurement"),
  log("2026-10-05", "P1500", "inspection"),
  log("2026-10-20", "P1501", "handover", { handoverSigned: true }),
  log("2026-10-21", "P1501", "handover"),
  log("2026-10-22", "P1503", "shooting"),
  log("2026-10-23", "P1503", "shooting"),
  log("2026-10-24", "P1504", "delivery"),
  log("2026-09-30", "P1499", "installation"),
  log("2026-11-01", "P1505", "touch_up"),
];

describe("buildSiteMonthlyReport", () => {
  const report = buildSiteMonthlyReport({
    name: "Raj Kumar",
    month: "2026-10-01",
    logs,
    claims: [],
  });

  it("lists only the month, earliest first, numbered, with the weekday", () => {
    expect(report.itinerary.map((row) => row.date)).toEqual([
      "2026-10-05",
      "2026-10-05",
      "2026-10-12",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
    expect(report.itinerary.map((row) => row.no)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(report.itinerary[0]).toMatchObject({
      day: "Mon",
      mofNo: "P1500",
      site: "Site P1500",
      activity: "Measurement",
    });
  });

  it("writes the notes and a signed handover into the details", () => {
    expect(report.itinerary[2].details).toBe("Lobby done");
    expect(report.itinerary[3].details).toBe("Handover signed");
    expect(report.itinerary[4].details).toBe("");
  });

  it("counts one site visit per site per day", () => {
    // 5 Oct (P1500 twice), 12, 20, 21, 22, 23 and 24 Oct
    expect(report.siteVisits).toBe(7);
  });

  it("counts only signed handovers and every shooting", () => {
    expect(report.handoversSigned).toBe(1);
    expect(report.shootings).toBe(2);
  });

  it("counts the template's activities, with deliveries under Others", () => {
    expect(report.summary).toEqual([
      { label: "Measurement", count: 1 },
      { label: "Inspection", count: 1 },
      { label: "Installation", count: 1 },
      { label: "Handover", count: 2 },
      { label: "Shooting", count: 2 },
      { label: "Touch Up", count: 0 },
      { label: "Others", count: 1 },
    ]);
    expect(report.totalActivities).toBe(8);
  });
});

describe("overtime in the monthly report", () => {
  it("adds hours for the month and leaves out rejected claims", () => {
    const report = buildSiteMonthlyReport({
      name: "Raj Kumar",
      month: "2026-10-01",
      logs: [],
      claims: [
        claim("2026-10-03", 2.5),
        claim("2026-10-04", 1.5, { status: "pending", approvedBy: null }),
        claim("2026-10-05", 4, { status: "rejected" }),
        claim("2026-09-30", 3),
      ],
    });
    expect(report.overtime.map((row) => row.workDate)).toEqual([
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(report.overtime.map((row) => row.no)).toEqual([1, 2]);
    expect(report.overtimeHours).toBe(4);
  });

  it("keeps hours exact to a tenth", () => {
    const report = buildSiteMonthlyReport({
      name: "Raj Kumar",
      month: "2026-10-01",
      logs: [],
      claims: [claim("2026-10-03", 0.1), claim("2026-10-04", 0.2)],
    });
    expect(report.overtimeHours).toBe(0.3);
  });
});

describe("dayName", () => {
  it("gives the weekday of a date", () => {
    expect(dayName("2026-11-06")).toBe("Fri");
    expect(dayName("2026-11-08")).toBe("Sun");
  });
});
