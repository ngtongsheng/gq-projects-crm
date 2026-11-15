import { describe, expect, it } from "vitest";
import { ReportTargets, siteStats } from "./report-stats";
import {
  buildItinerary,
  type ReportBooking,
  type ReportSiteLog,
  shootingHandoverRows,
  stockReturnCounts,
} from "./site-report";

const NOV = "2026-11-01";
const TODAY = "2026-11-20";

const log = (over: Partial<ReportSiteLog> = {}): ReportSiteLog => ({
  mofId: "mof-a",
  projectId: "proj-a",
  siteLabel: "Alpha",
  visitedOn: "2026-11-03",
  activity: "inspection",
  handoverSigned: false,
  driveLink: null,
  ...over,
});

const booking = (over: Partial<ReportBooking> = {}): ReportBooking => ({
  projectId: "proj-a",
  siteLabel: "Alpha",
  visitOn: "2026-11-03",
  purposeLabel: "Site inspection",
  ...over,
});

describe("buildItinerary", () => {
  it("makes one line per site per day however many activities were logged", () => {
    const { lines, counts } = buildItinerary({
      month: NOV,
      today: TODAY,
      logs: [
        log({ activity: "inspection" }),
        log({ activity: "measurement" }),
        log({ visitedOn: "2026-11-04" }),
        log({ mofId: "mof-b", projectId: "proj-b", siteLabel: "Beta" }),
      ],
      bookings: [],
    });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({
      day: "2026-11-03",
      siteLabel: "Alpha",
      work: ["Inspection", "Measurement"],
    });
    expect(counts.visits).toBe(3);
  });

  it("agrees with the report's site-visit figure", () => {
    const logs = [
      log(),
      log({ activity: "handover" }),
      log({ visitedOn: "2026-11-05" }),
      log({ visitedOn: "2026-10-30" }),
    ];
    const { counts } = buildItinerary({
      month: NOV,
      today: TODAY,
      logs,
      bookings: [],
    });
    const stats = siteStats({
      personId: "me",
      month: NOV,
      targets: ReportTargets.parse({}),
      otClaims: [],
      siteLogs: logs.map((entry) => ({
        supervisorId: "me",
        mofId: entry.mofId,
        visitedOn: entry.visitedOn,
        activity: entry.activity,
        handoverSigned: entry.handoverSigned,
      })),
    });
    expect(stats.kind === "site" && stats.siteVisits).toBe(counts.visits);
  });

  it("tells scheduled from added on the day", () => {
    const { lines, counts } = buildItinerary({
      month: NOV,
      today: TODAY,
      logs: [
        log(),
        log({ mofId: "mof-b", projectId: "proj-b", siteLabel: "Beta" }),
      ],
      bookings: [booking()],
    });
    expect(lines.map((line) => line.origin)).toEqual(["as_planned", "added"]);
    expect(counts).toEqual({
      visits: 2,
      scheduled: 1,
      asPlanned: 1,
      added: 1,
      notLogged: 0,
    });
  });

  it("does not match a booking on another day or another site", () => {
    const { counts } = buildItinerary({
      month: NOV,
      today: TODAY,
      logs: [log()],
      bookings: [
        booking({ visitOn: "2026-11-04" }),
        booking({ projectId: "proj-z", siteLabel: "Zed" }),
      ],
    });
    expect(counts).toEqual({
      visits: 1,
      scheduled: 2,
      asPlanned: 0,
      added: 1,
      notLogged: 2,
    });
  });

  it("flags a booked day that passed with nothing logged, not one still to come", () => {
    const { lines, counts } = buildItinerary({
      month: NOV,
      today: TODAY,
      logs: [],
      bookings: [
        booking({ visitOn: "2026-11-10" }),
        booking({ visitOn: "2026-11-25" }),
        booking({ visitOn: "2026-11-25" }),
      ],
    });
    expect(lines.map((line) => line.origin)).toEqual([
      "not_logged",
      "upcoming",
    ]);
    expect(counts).toMatchObject({ scheduled: 2, notLogged: 1, visits: 0 });
  });

  it("matches a typed-in site by name and ignores other months", () => {
    const { lines, counts } = buildItinerary({
      month: NOV,
      today: TODAY,
      logs: [log({ visitedOn: "2026-10-31" })],
      bookings: [
        booking({ projectId: null, siteLabel: "Mall X" }),
        booking({ visitOn: "2026-12-01" }),
      ],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      siteLabel: "Mall X",
      origin: "not_logged",
    });
    expect(counts.visits).toBe(0);
  });
});

describe("shootingHandoverRows", () => {
  it("lists shootings and handovers in date order with whether each is done", () => {
    const rows = shootingHandoverRows(
      [
        log({
          activity: "handover",
          handoverSigned: true,
          visitedOn: "2026-11-09",
        }),
        log({ activity: "shooting", driveLink: null, visitedOn: "2026-11-02" }),
        log({
          activity: "shooting",
          driveLink: "https://x.test/a",
          visitedOn: "2026-11-06",
        }),
        log({ activity: "handover", visitedOn: "2026-10-31" }),
        log({ activity: "installation" }),
      ],
      NOV,
    );
    expect(rows.map((row) => [row.day, row.activity, row.done])).toEqual([
      ["2026-11-02", "shooting", false],
      ["2026-11-06", "shooting", true],
      ["2026-11-09", "handover", true],
    ]);
  });
});

describe("stockReturnCounts", () => {
  it("counts items by where they go and how many still wait for pickup", () => {
    expect(
      stockReturnCounts([
        { destination: "supplier", status: "pending_pickup" },
        { destination: "supplier", status: "returned_to_supplier" },
        { destination: "gq", status: "pending_pickup" },
        { destination: "gq", status: "at_best_link" },
      ]),
    ).toEqual({ recorded: 4, toSupplier: 2, keptByGq: 2, pendingPickup: 2 });
    expect(stockReturnCounts([])).toEqual({
      recorded: 0,
      toSupplier: 0,
      keptByGq: 0,
      pendingPickup: 0,
    });
  });
});
