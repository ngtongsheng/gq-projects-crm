import { describe, expect, it } from "vitest";
import type { CalendarBooking } from "./booking-data";
import { calendarItems } from "./calendar-items";
import type { CalendarJob } from "./calendar-jobs";

const job = (overrides: Partial<CalendarJob>): CalendarJob =>
  ({
    id: "job",
    jobType: "installation",
    status: "scheduled",
    scheduledOn: "2026-11-10",
    endsOn: "2026-11-10",
    startTime: "",
    mofNo: "MOF-1",
    companyName: "Acme",
    ...overrides,
  }) as CalendarJob;

const booking = (overrides: Partial<CalendarBooking>): CalendarBooking => ({
  id: "b1",
  supervisorId: "sup",
  requestedBy: "sales",
  purpose: "site_measurement",
  visitOn: "2026-11-10",
  startTime: "10:00",
  siteLabel: "Data centre",
  notes: "",
  status: "requested",
  declineReason: "",
  ...overrides,
});

const run = (jobs: CalendarJob[], bookings: CalendarBooking[]) =>
  calendarItems({
    jobs,
    bookings,
    from: "2026-11-09",
    to: "2026-11-15",
    supervisorName: () => "Awal",
    hrefFor: (day) => `/installation?date=${day}`,
  });

describe("calendarItems", () => {
  it("puts jobs and bookings on the same day in time order, untimed last", () => {
    const day = run(
      [job({ id: "all-day" }), job({ id: "early", startTime: "08:30" })],
      [booking({ id: "b1", startTime: "10:00" })],
    ).get("2026-11-10");

    expect(day?.map((item) => item.id)).toEqual([
      "early",
      "booking-b1",
      "all-day",
    ]);
  });

  it("describes a booking by purpose, supervisor and site", () => {
    const [item] = run([], [booking({})]).get("2026-11-10") ?? [];

    expect(item).toMatchObject({
      title: "Site measurement · Awal",
      detail: "Data centre",
      time: "10:00",
      tone: "warn",
      muted: false,
    });
  });

  it("fades a declined booking and ignores one outside the range", () => {
    const items = run(
      [],
      [
        booking({ id: "no", status: "declined" }),
        booking({ id: "out", visitOn: "2026-11-20" }),
      ],
    );

    expect(items.get("2026-11-10")).toHaveLength(1);
    expect(items.get("2026-11-10")?.[0]?.muted).toBe(true);
    expect(items.has("2026-11-20")).toBe(false);
  });
});
