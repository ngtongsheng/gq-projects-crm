import { expect, test } from "vitest";
import type { CalendarActivity } from "./calendar-data";
import { eventsByDay } from "./calendar-events";

const ME = "me";
const EDDIE = "eddie";
const nameOf = new Map([
  [ME, "Mei"],
  [EDDIE, "Eddie"],
]);

function activity(overrides: Partial<CalendarActivity>): CalendarActivity {
  return {
    id: "a1",
    contact_id: "c1",
    owner_id: ME,
    type: "visit",
    purpose: "Quote",
    outcome: null,
    starts_at: "2099-01-05T01:30:00Z",
    status: "planned",
    activity_invitees: [],
    contacts: { name: "Lim", companies: { name: "Acme" } },
    ...overrides,
  };
}

const build = (activities: CalendarActivity[], personId: string | undefined) =>
  eventsByDay({
    activities,
    meId: ME,
    personId,
    nameOf,
    replyHref: (day) => `/reply/${day}`,
  });

test("groups by the Malaysia day, not the UTC day", () => {
  // 17:00 UTC on the 5th is 01:00 on the 6th in Malaysia.
  const byDay = build([activity({ starts_at: "2099-01-05T17:00:00Z" })], ME);
  expect([...byDay.keys()]).toEqual(["2099-01-06"]);
  expect(byDay.get("2099-01-06")?.[0].time).toBe("01:00");
});

test("names the salesperson only when looking at a team", () => {
  const mine = build([activity({})], ME).get("2099-01-05")?.[0];
  const team = build([activity({})], undefined).get("2099-01-05")?.[0];
  expect(mine?.time).toBe("09:30");
  expect(team?.time).toBe("09:30 · Mei");
});

test("an invitation waiting for a reply links to the week and is flagged", () => {
  const event = build(
    [
      activity({
        owner_id: EDDIE,
        activity_invitees: [{ profile_id: ME, status: "pending" }],
      }),
    ],
    ME,
  ).get("2099-01-05")?.[0];
  expect(event?.awaitingReply).toBe(true);
  expect(event?.href).toBe("/reply/2099-01-05");
  expect(event?.tone).toBe("warn");
});

test("a planned visit whose time has passed asks for its outcome", () => {
  const event = build(
    [activity({ starts_at: "2020-01-05T01:30:00Z" })],
    ME,
  ).get("2020-01-05")?.[0];
  expect(event?.detail).toBe("Log outcome · Visit · Quote");
  expect(event?.href).toBe("/customers/c1");
});
