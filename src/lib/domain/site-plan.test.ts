import { describe, expect, it } from "vitest";
import {
  isPlannedWorkRecorded,
  type PlanBooking,
  type PlanJob,
  plannedWork,
  shouldRemindToLog,
} from "./site-plan";

const job = (extra: Partial<PlanJob> = {}): PlanJob => ({
  jobType: "installation",
  status: "scheduled",
  scheduledOn: "2026-11-10",
  endsOn: "2026-11-10",
  mofId: "mof-1",
  mofNo: "MOF-0001",
  projectName: "Menara ABC",
  startTime: "09:00",
  notes: "",
  ...extra,
});

const booking = (extra: Partial<PlanBooking> = {}): PlanBooking => ({
  purpose: "site_measurement",
  status: "confirmed",
  visitOn: "2026-11-10",
  startTime: "14:00",
  projectId: "project-1",
  siteLabel: "Wisma XYZ",
  notes: "",
  ...extra,
});

const range = { from: "2026-11-09", to: "2026-11-12" };

describe("plannedWork", () => {
  it("plans a multi-day job on each day inside the range", () => {
    const planned = plannedWork({
      ...range,
      jobs: [job({ scheduledOn: "2026-11-08", endsOn: "2026-11-10" })],
      bookings: [],
    });
    expect(planned.map((work) => work.day)).toEqual([
      "2026-11-09",
      "2026-11-10",
    ]);
  });

  it("leaves out postponed jobs and declined bookings", () => {
    const planned = plannedWork({
      ...range,
      jobs: [job({ status: "postponed" })],
      bookings: [booking({ status: "declined" })],
    });
    expect(planned).toEqual([]);
  });

  it("keeps requested bookings and maps purposes to activities", () => {
    const planned = plannedWork({
      ...range,
      jobs: [],
      bookings: [
        booking({ status: "requested", purpose: "meet_client" }),
        booking({ purpose: "shooting", startTime: "08:00" }),
      ],
    });
    expect(planned.map((work) => work.activity)).toEqual([
      "shooting",
      "inspection",
    ]);
  });

  it("maps job types to activities and labels the MOF", () => {
    const [work] = plannedWork({
      ...range,
      jobs: [job({ jobType: "site_measurement" })],
      bookings: [],
    });
    expect(work).toMatchObject({
      activity: "measurement",
      siteLabel: "MOF-0001 · Menara ABC",
      mofId: "mof-1",
    });
  });

  it("orders by day, then start time, with untimed jobs last", () => {
    const planned = plannedWork({
      ...range,
      jobs: [
        job({ startTime: "" }),
        job({ scheduledOn: "2026-11-09", endsOn: "2026-11-09" }),
      ],
      bookings: [booking({ startTime: "08:00" })],
    });
    expect(planned.map((work) => [work.day, work.startTime])).toEqual([
      ["2026-11-09", "09:00"],
      ["2026-11-10", "08:00"],
      ["2026-11-10", ""],
    ]);
  });

  it("names a booking's typed-in site only when it has no project", () => {
    const [typed] = plannedWork({
      ...range,
      jobs: [],
      bookings: [booking({ projectId: null })],
    });
    expect(typed).toMatchObject({ projectId: null, siteName: "Wisma XYZ" });
  });
});

describe("isPlannedWorkRecorded", () => {
  const [work] = plannedWork({ ...range, jobs: [job()], bookings: [] });
  const log = {
    visitedOn: "2026-11-10",
    mofId: "mof-1",
    siteName: null,
    projectId: null,
    activity: "installation" as const,
  };

  it("is recorded when that activity was logged at the site that day", () => {
    expect(work && isPlannedWorkRecorded(work, [log])).toBe(true);
  });

  it("is not recorded for another activity, site or day", () => {
    if (!work) throw new Error("expected a planned job");
    expect(
      isPlannedWorkRecorded(work, [{ ...log, activity: "delivery" }]),
    ).toBe(false);
    expect(isPlannedWorkRecorded(work, [{ ...log, mofId: "mof-2" }])).toBe(
      false,
    );
    expect(
      isPlannedWorkRecorded(work, [{ ...log, visitedOn: "2026-11-09" }]),
    ).toBe(false);
  });
});

describe("shouldRemindToLog", () => {
  const base = {
    today: "2026-11-10",
    hourMyt: 17,
    holidays: new Set<string>(),
    away: [],
    loggedToday: false,
  };

  it("reminds from 17:00 on a site day with nothing logged", () => {
    expect(shouldRemindToLog(base)).toBe(true);
    expect(shouldRemindToLog({ ...base, hourMyt: 16 })).toBe(false);
  });

  it("does not remind once logged, on a holiday, a Sunday or an away day", () => {
    expect(shouldRemindToLog({ ...base, loggedToday: true })).toBe(false);
    expect(
      shouldRemindToLog({ ...base, holidays: new Set(["2026-11-10"]) }),
    ).toBe(false);
    expect(shouldRemindToLog({ ...base, today: "2026-11-15" })).toBe(false);
    expect(
      shouldRemindToLog({
        ...base,
        away: [{ startsOn: "2026-11-09", endsOn: "2026-11-11" }],
      }),
    ).toBe(false);
  });
});
