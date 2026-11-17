import { describe, expect, it } from "vitest";
import { eventListRows, eventSheet } from "./marketing-events";
import type {
  EventCostLine,
  MarketingEvent,
  MarketingExpense,
} from "./marketing-types";

const EVENT = "11111111-1111-4111-8111-111111111111";
const categories = [
  { id: "c-booth", name: "Events & Exhibitions" },
  { id: "c-gift", name: "Merchandise & Gifts" },
];

const line = (fields: Partial<EventCostLine>): EventCostLine => ({
  id: crypto.randomUUID(),
  costGroup: "Booth",
  description: null,
  supplierRef: null,
  foreignAmount: null,
  rate: 100,
  unit: "ls",
  qty: 1,
  total: 100,
  remarks: null,
  ...fields,
});

const event = (fields: Partial<MarketingEvent> = {}): MarketingEvent => ({
  id: EVENT,
  name: "Index Dubai",
  startsOn: null,
  endsOn: null,
  venue: null,
  budget: null,
  notes: null,
  costs: [],
  ...fields,
});

const expense = (fields: Partial<MarketingExpense>): MarketingExpense => ({
  id: crypto.randomUUID(),
  spentOn: "2026-05-01",
  categoryId: "c-booth",
  description: "Deposit",
  vendorName: "Expo Co",
  invoiceRef: null,
  currency: "RM",
  amount: 50,
  amountRm: 50,
  eventId: EVENT,
  eventName: "Index Dubai",
  paymentMethod: "bank_transfer",
  remarks: null,
  createdAt: "2026-05-01T00:00:00Z",
  ...fields,
});

describe("eventSheet", () => {
  it("adds the cost lines and the tagged expense lines, and ignores other events", () => {
    const sheet = eventSheet(
      event({ costs: [line({ total: 0.1 }), line({ total: 0.2 })] }),
      [
        expense({ amountRm: 0.3 }),
        expense({ amountRm: 999, eventId: "other" }),
        expense({ amountRm: 999, eventId: null }),
      ],
      categories,
    );
    expect(sheet.total).toBe(0.6);
    expect(sheet.items).toHaveLength(3);
    expect(sheet.fromLog).toBe(1);
  });

  it("files an expense line under its category and keeps the foreign amount", () => {
    const sheet = eventSheet(
      event(),
      [
        expense({
          categoryId: "c-gift",
          currency: "RMB",
          amount: 2700,
          amountRm: 1700,
          invoiceRef: "INV-9",
        }),
      ],
      categories,
    );
    expect(sheet.items[0]).toMatchObject({
      source: "log",
      group: "Merchandise & Gifts",
      foreignAmount: "RMB 2700",
      supplierRef: "Expo Co · INV-9",
      total: 1700,
    });
  });

  it("flags over budget only when the cost is above it", () => {
    const costs = [line({ total: 1000 })];
    expect(
      eventSheet(event({ budget: 999.99, costs }), [], categories),
    ).toMatchObject({ over: true, left: -0.01 });
    expect(
      eventSheet(event({ budget: 1000, costs }), [], categories),
    ).toMatchObject({ over: false, left: 0 });
    expect(
      eventSheet(event({ budget: null, costs }), [], categories),
    ).toMatchObject({ over: false, left: null });
  });

  it("counts the expense lines towards the budget", () => {
    const sheet = eventSheet(
      event({ budget: 1000, costs: [line({ total: 900 })] }),
      [expense({ amountRm: 150 })],
      categories,
    );
    expect(sheet).toMatchObject({ total: 1050, over: true, left: -50 });
  });

  it("summarises each cost group with its share, biggest first", () => {
    const sheet = eventSheet(
      event({
        costs: [
          line({ costGroup: "Booth", total: 600 }),
          line({ costGroup: "Booth", total: 100 }),
          line({ costGroup: "Travel", total: 200 }),
        ],
      }),
      [expense({ categoryId: "c-gift", amountRm: 100 })],
      categories,
    );
    expect(
      sheet.groups.map(({ group, total, percent }) => [group, total, percent]),
    ).toEqual([
      ["Booth", 700, 70],
      ["Travel", 200, 20],
      ["Merchandise & Gifts", 100, 10],
    ]);
    expect(sheet.groups[0].items).toHaveLength(2);
  });

  it("has no shares for an event with nothing costed", () => {
    expect(eventSheet(event(), [], categories)).toMatchObject({
      total: 0,
      groups: [],
      over: false,
    });
  });
});

describe("eventListRows", () => {
  it("shows each event's item count and cost, red only when over its budget", () => {
    const other = event({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Home Fair",
      budget: 500,
      costs: [line({ total: 400 })],
    });
    const rows = eventListRows(
      [event({ budget: 100, costs: [line({ total: 80 })] }), other],
      [expense({ amountRm: 50 })],
      categories,
    );
    expect(
      rows.map(({ name, items, cost, over }) => [name, items, cost, over]),
    ).toEqual([
      ["Index Dubai", 2, 130, true],
      ["Home Fair", 1, 400, false],
    ]);
  });
});
