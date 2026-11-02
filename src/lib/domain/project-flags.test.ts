import { expect, test } from "vitest";
import { projectFlags } from "./project-flags";

const today = "2026-11-20";
// 09:00 in Kuala Lumpur on the given day.
const updatedOn = (day: string) => `${day}T01:00:00Z`;

const flags = (overrides: Partial<Parameters<typeof projectFlags>[0]> = {}) =>
  projectFlags(
    {
      open: true,
      nextActionDate: null,
      updatedAt: updatedOn(today),
      ...overrides,
    },
    today,
  );

test("overdue only after the next action date has passed", () => {
  expect(flags({ nextActionDate: "2026-11-19" }).overdue).toBe(true);
  expect(flags({ nextActionDate: "2026-11-20" }).overdue).toBe(false);
  expect(flags({ nextActionDate: "2026-11-21" }).overdue).toBe(false);
  expect(flags({ nextActionDate: null }).overdue).toBe(false);
});

test("stale only after more than 14 days without an update", () => {
  expect(flags({ updatedAt: updatedOn("2026-11-06") }).stale).toBe(false);
  expect(flags({ updatedAt: updatedOn("2026-11-05") }).stale).toBe(true);
});

test("stale counts days in Malaysia time", () => {
  // 17:00 UTC on 5 Nov is 01:00 on 6 Nov in Kuala Lumpur: 14 days, not stale.
  expect(flags({ updatedAt: "2026-11-05T17:00:00Z" }).stale).toBe(false);
});

test("closed stages are never flagged", () => {
  expect(
    flags({
      open: false,
      nextActionDate: "2026-01-01",
      updatedAt: updatedOn("2026-01-01"),
    }),
  ).toEqual({ overdue: false, stale: false });
});
