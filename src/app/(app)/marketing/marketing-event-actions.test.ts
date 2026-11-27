import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  deleteMarketingEvent,
  deleteMarketingEventCost,
  saveMarketingEvent,
  saveMarketingEventCost,
} from "./marketing-event-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const EVENT = "44444444-4444-4444-8444-444444444444";
const COST = "55555555-5555-4555-8555-555555555555";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Mei",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
});

type Write = { table: string; op: string; row?: Record<string, unknown> };
const writes: Write[] = [];

function givenDatabase(
  change: { data?: unknown[]; error?: { code: string } | null } = {},
) {
  const done = (table: string, op: string, row?: Record<string, unknown>) => {
    writes.push({ table, op, row });
    const answer = {
      data: change.data ?? [{ id: EVENT }],
      error: change.error ?? null,
    };
    const chain = {
      eq: () => chain,
      select: () => Promise.resolve(answer),
    };
    return chain;
  };
  const client = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => done(table, "insert", row),
      update: (row: Record<string, unknown>) => done(table, "update", row),
      delete: () => done(table, "delete"),
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

const form = {
  id: "",
  name: " Index Dubai ",
  startsOn: "2026-05-01",
  endsOn: "2026-05-04",
  venue: " Expo Centre ",
  budget: "RM 20,000",
  notes: "",
};

const cost = {
  id: "",
  eventId: EVENT,
  costGroup: " Booth ",
  description: "Shell scheme",
  supplierRef: "",
  foreignAmount: "RMB 2700",
  rate: "12.5",
  unit: "",
  qty: "",
  remarks: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  writes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("marketing"));
});

describe("saveMarketingEvent", () => {
  it("adds an event and gives back its id", async () => {
    givenDatabase();
    expect(await saveMarketingEvent(form)).toEqual({ error: null, id: EVENT });
    expect(writes).toEqual([
      {
        table: "marketing_events",
        op: "insert",
        row: {
          name: "Index Dubai",
          starts_on: "2026-05-01",
          ends_on: "2026-05-04",
          venue: "Expo Centre",
          budget: 20000,
          notes: null,
        },
      },
    ]);
  });

  it("saves no budget when blank or 0", async () => {
    givenDatabase();
    await saveMarketingEvent({ ...form, budget: "" });
    await saveMarketingEvent({ ...form, budget: "0" });
    expect(writes.map((write) => write.row?.budget)).toEqual([null, null]);
  });

  it.each([
    ["an empty name", { name: " " }, "Fill in the event name."],
    [
      "an end before the start",
      { endsOn: "2026-04-30" },
      "The end date is before the start date.",
    ],
    ["a bad budget", { budget: "lots" }, "The budget must be an amount in RM."],
  ])("refuses %s", async (_what, change, message) => {
    givenDatabase();
    expect(await saveMarketingEvent({ ...form, ...change })).toEqual({
      error: message,
    });
    expect(writes).toEqual([]);
  });

  it("saves changes to an existing event", async () => {
    givenDatabase();
    await saveMarketingEvent({ ...form, id: EVENT });
    expect(writes[0]?.op).toBe("update");
  });

  it("says so when the name is taken", async () => {
    givenDatabase({ error: { code: "23505" } });
    expect(await saveMarketingEvent(form)).toEqual({
      error: "An event with that name already exists.",
    });
  });

  it("refuses HR & Accounts, who only look", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await saveMarketingEvent(form)).error).toBe(
      "You can look at this page but not change it.",
    );
    expect(writes).toEqual([]);
  });
});

describe("deleteMarketingEvent", () => {
  it("deletes an event nothing refers to", async () => {
    givenDatabase();
    expect(await deleteMarketingEvent(EVENT)).toEqual({ error: null });
    expect(writes[0]).toMatchObject({
      table: "marketing_events",
      op: "delete",
    });
  });

  it("explains the refusal when a cost line or expense uses the event", async () => {
    givenDatabase({ error: { code: "23503" } });
    expect(await deleteMarketingEvent(EVENT)).toEqual({
      error: "This event has cost lines or expenses, so it can't be deleted.",
    });
  });
});

describe("saveMarketingEventCost", () => {
  it("adds a cost line, with unit ls and quantity 1 when left blank", async () => {
    givenDatabase();
    expect(await saveMarketingEventCost(cost)).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "marketing_event_costs",
        op: "insert",
        row: {
          event_id: EVENT,
          cost_group: "Booth",
          description: "Shell scheme",
          supplier_ref: null,
          foreign_amount: "RMB 2700",
          rate: 12.5,
          unit: "ls",
          qty: 1,
          remarks: null,
        },
      },
    ]);
  });

  it("keeps a typed unit and quantity", async () => {
    givenDatabase();
    await saveMarketingEventCost({ ...cost, unit: "pcs", qty: "3" });
    expect(writes[0]?.row).toMatchObject({ unit: "pcs", qty: 3 });
  });

  it.each([
    ["no event", { eventId: "" }],
    ["no cost group", { costGroup: " " }],
    ["no rate", { rate: "" }],
    ["a rate that is not a number", { rate: "abc" }],
  ])(
    "asks for the event, cost group and rate when there is %s",
    async (_what, change) => {
      givenDatabase();
      expect(await saveMarketingEventCost({ ...cost, ...change })).toEqual({
        error: "Choose the event and fill in cost group and rate.",
      });
      expect(writes).toEqual([]);
    },
  );

  it("refuses a quantity of 0", async () => {
    givenDatabase();
    expect(await saveMarketingEventCost({ ...cost, qty: "0" })).toEqual({
      error: "The quantity must be more than 0.",
    });
  });

  it("saves changes to an existing line", async () => {
    givenDatabase();
    await saveMarketingEventCost({ ...cost, id: COST });
    expect(writes[0]?.op).toBe("update");
  });

  it("says so when the line to change is gone", async () => {
    givenDatabase({ data: [] });
    expect(await saveMarketingEventCost({ ...cost, id: COST })).toEqual({
      error: "Could not find that cost line. Reload the page.",
    });
  });

  it("refuses HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await saveMarketingEventCost(cost)).error).toBe(
      "You can look at this page but not change it.",
    );
    expect(writes).toEqual([]);
  });
});

describe("deleteMarketingEventCost", () => {
  it("deletes a cost line", async () => {
    givenDatabase();
    expect(await deleteMarketingEventCost(COST)).toEqual({ error: null });
    expect(writes[0]).toMatchObject({
      table: "marketing_event_costs",
      op: "delete",
    });
  });

  it("refuses HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await deleteMarketingEventCost(COST)).error).toBe(
      "You can look at this page but not change it.",
    );
  });
});
