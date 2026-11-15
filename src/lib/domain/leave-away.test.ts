import { describe, expect, it } from "vitest";
import { type AwayEntry, awayByDay } from "./leave-away";

const ANNA = "00000000-0000-4000-8000-000000000001";
const SITE = "00000000-0000-4000-8000-000000000002";

const request = (
  over: Partial<Parameters<typeof awayByDay>[0][number]> = {},
) => ({
  personId: ANNA,
  leaveType: "annual" as const,
  status: "approved" as const,
  startsOn: "2027-03-04",
  endsOn: "2027-03-09",
  halfDay: null,
  ...over,
});

const roles = (personId: string) => (personId === SITE ? "site" : "sales");

describe("awayByDay", () => {
  it("lists a person on each working day of approved leave, skipping the weekend and holidays", () => {
    const byDay = awayByDay(
      [request()],
      roles,
      new Set(["2027-03-08"]),
      "2027-03-01",
      "2027-03-31",
    );
    // Thu 4, Fri 5, (Sat 6, Sun 7), (Mon 8 is a holiday), Tue 9
    expect([...byDay.keys()]).toEqual([
      "2027-03-04",
      "2027-03-05",
      "2027-03-09",
    ]);
  });

  it("counts Saturday for a site supervisor", () => {
    const byDay = awayByDay(
      [request({ personId: SITE })],
      roles,
      new Set(),
      "2027-03-01",
      "2027-03-31",
    );
    expect(byDay.has("2027-03-06")).toBe(true);
    expect(byDay.has("2027-03-07")).toBe(false);
  });

  it("ignores leave that is not approved", () => {
    const byDay = awayByDay(
      [request({ status: "pending" }), request({ status: "rejected" })],
      roles,
      new Set(),
      "2027-03-01",
      "2027-03-31",
    );
    expect(byDay.size).toBe(0);
  });

  it("clips leave to the range and keeps the half day", () => {
    const byDay = awayByDay(
      [request({ startsOn: "2027-02-26", endsOn: "2027-03-02" })],
      roles,
      new Set(),
      "2027-03-01",
      "2027-03-31",
    );
    expect([...byDay.keys()]).toEqual(["2027-03-01", "2027-03-02"]);
    const half = awayByDay(
      [
        request({
          startsOn: "2027-03-04",
          endsOn: "2027-03-04",
          halfDay: "am",
        }),
      ],
      roles,
      new Set(),
      "2027-03-01",
      "2027-03-31",
    );
    expect(half.get("2027-03-04")).toEqual<AwayEntry[]>([
      { personId: ANNA, leaveType: "annual", halfDay: "am" },
    ]);
  });
});
