import { describe, expect, it } from "vitest";
import { attentionItems } from "./attention";
import { daysWaiting, PICKUP_LATE_AFTER_DAYS, pickupCounts } from "./leftover";

const TODAY = "2026-11-06";
// A timestamp as the database stores it: Malaysia midnight is 16:00 the day before, in UTC.
const recorded = (day: string) => `${day}T03:00:00+00:00`;

describe("daysWaiting", () => {
  it("counts whole days since the item was recorded, in Malaysia time", () => {
    expect(daysWaiting(recorded("2026-11-06"), TODAY)).toBe(0);
    expect(daysWaiting(recorded("2026-11-02"), TODAY)).toBe(4);
  });

  it("is never negative", () => {
    expect(daysWaiting(recorded("2026-11-09"), TODAY)).toBe(0);
  });
});

describe("pickupCounts", () => {
  const items = [
    { status: "pending_pickup", recordedOn: recorded("2026-11-05") },
    { status: "pending_pickup", recordedOn: recorded("2026-11-03") },
    { status: "pending_pickup", recordedOn: recorded("2026-10-20") },
    { status: "returned_to_supplier", recordedOn: recorded("2026-09-01") },
    { status: "at_best_link", recordedOn: recorded("2026-08-01") },
  ];

  it("counts only items still waiting for pickup", () => {
    expect(pickupCounts(items, TODAY).waiting).toBe(3);
  });

  it("calls an item late once it has waited more than 3 days", () => {
    expect(PICKUP_LATE_AFTER_DAYS).toBe(3);
    // 5 Nov: 1 day, 3 Nov: 3 days (not late yet), 20 Oct: 17 days (late)
    expect(pickupCounts(items, TODAY).late).toBe(1);
  });

  it("has nothing when nothing waits", () => {
    expect(pickupCounts([], TODAY)).toEqual({ waiting: 0, late: 0 });
  });
});

describe("the pickup alerts", () => {
  const facts = { leftoversToPickUp: 3, leftoversLate: 1 };

  it("tell Purchasing and the MD, late ones first and in red", () => {
    for (const role of ["support", "md"] as const) {
      const items = attentionItems(role, facts).filter((item) =>
        item.key.startsWith("leftovers"),
      );
      expect(items.map((item) => item.key)).toEqual([
        "leftoversLate",
        "leftoversToPickUp",
      ]);
      expect(items[0]).toMatchObject({
        tone: "bad",
        href: "/stock/leftover",
        label: "1 leftover item has waited more than 3 days for pickup",
      });
      expect(items[1]).toMatchObject({
        tone: "warn",
        label:
          "3 leftover items from sites waiting for pickup: arrange transport",
      });
    }
  });

  it("are not shown to salespeople or the Sales Director", () => {
    for (const role of [
      "sales",
      "bd",
      "director",
      "accounts",
      "site",
    ] as const) {
      expect(attentionItems(role, facts)).toEqual([]);
    }
  });
});
