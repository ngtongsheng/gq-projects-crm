import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import type { JobRole } from "@/lib/auth/job-role";
import { createClient } from "@/lib/supabase/server";
import {
  approveCosting,
  chooseOption,
  openRevision,
  returnCosting,
  sendCosting,
} from "./approval-actions";

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
}));

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const QUOTE = "44444444-4444-4444-8444-444444444444";
const REVISION = "55555555-5555-4555-8555-555555555555";
const OPTION_A = "66666666-6666-4666-8666-666666666666";
const OPTION_B = "77777777-7777-4777-8777-777777777777";
const CARPET = "88888888-8888-4888-8888-888888888888";
const FITTING = "99999999-9999-4999-8999-999999999999";
const NEW_REVISION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const profile = (jobRole: JobRole): Profile => ({
  id: ME,
  fullName: "Ah Kow",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: [string, unknown][];
};

type Chain = Promise<Result> & {
  select: () => Chain;
  insert: (payload: unknown) => Chain;
  update: (payload: unknown) => Chain;
  eq: (column: string, value: unknown) => Chain;
  order: () => Chain;
  single: () => Chain;
  maybeSingle: () => Chain;
};

/** Records every query and answers it with `respond`. */
function fakeSupabase(respond: (call: Call) => Result) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      const query: Chain = Object.assign(
        Promise.resolve().then(() => respond(call)),
        {
          select: () => query,
          insert: (payload: unknown) => {
            call.op = "insert";
            call.payload = payload;
            return query;
          },
          update: (payload: unknown) => {
            call.op = "update";
            call.payload = payload;
            return query;
          },
          eq: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return query;
          },
          order: () => query,
          single: () => query,
          maybeSingle: () => query,
        },
      );
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return calls;
}

const ok = (data: unknown = null): Result => ({ data, error: null });

const line = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  position: 0,
  category: "transport",
  type: "lump",
  area: null,
  product: null,
  supplier: null,
  description: null,
  remark: null,
  unit: "trip",
  qty: 1,
  rate: 100,
  material: null,
  wastage_pct: null,
  underlay: null,
  accessories: null,
  install: null,
  currency: null,
  fob: null,
  fx: null,
  sst_pct: null,
  shipping: null,
  rug_mode: null,
  length: null,
  width: null,
  piece_cost: null,
  edging: null,
  cost: 60,
  linked_item_id: null,
  ...overrides,
});

const revisionRow = (
  overrides: {
    status?: string;
    owner?: string;
    rev?: number;
    revs?: number[];
    cost?: number | null;
  } = {},
) => ({
  id: REVISION,
  quote_id: QUOTE,
  rev: overrides.rev ?? 0,
  status: overrides.status ?? "draft",
  fx_usd: 4.6,
  fx_rmb: 0.62,
  sst_pct: 8,
  target_margin_pct: 35,
  quotes: {
    quote_no: "Q100",
    salesperson_id: overrides.owner ?? ME,
    quote_revisions: (overrides.revs ?? [0]).map((rev) => ({ rev })),
  },
  quote_options: [
    {
      id: OPTION_B,
      key: "B",
      label: "Nylon",
      quote_items: [line(FITTING)],
    },
    {
      id: OPTION_A,
      key: "A",
      label: "Wool",
      // Sell 100: cost 60 is a 40% margin, 80 is 20%.
      quote_items: [
        line(CARPET, {
          cost: overrides.cost === undefined ? 60 : overrides.cost,
        }),
      ],
    },
  ],
});

/** The revision loads as given, min margin 30%, and every write touches one row. */
function database(
  row = revisionRow(),
  updated: unknown[] = [{ id: REVISION }],
) {
  return fakeSupabase((call) => {
    if (call.table === "app_settings") return ok([{ value: 30 }]);
    if (call.table === "quote_revisions" && call.op === "select")
      return ok(row);
    if (call.table === "quote_revisions" && call.op === "update")
      return ok(updated);
    return ok();
  });
}

const writes = (calls: Call[]) => calls.filter((call) => call.op !== "select");
const find = (calls: Call[], table: string, op: Call["op"]) =>
  calls.filter((call) => call.table === table && call.op === op);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
});

describe("sendCosting", () => {
  it("confirms a costing at or above the minimum as OK to quote, with no figure in the note", async () => {
    const calls = database();

    const result = await sendCosting({ revisionId: REVISION, note: "" });

    expect(result.error).toBeNull();
    const [update] = find(calls, "quote_revisions", "update");
    expect(update.payload).toEqual({ status: "approved" });
    expect(update.filters).toContainEqual(["status", "draft"]);
    const [history] = find(calls, "quote_revision_history", "insert");
    expect(history.payload).toEqual({
      revision_id: REVISION,
      action: "approved",
      note: "Lowest margin meets the minimum. OK to quote.",
    });
    expect(JSON.stringify(history.payload)).not.toMatch(/\d+(\.\d+)?%/);
  });

  it("needs a reason below the minimum and writes nothing without one", async () => {
    const calls = database(revisionRow({ cost: 80 }));

    const result = await sendCosting({ revisionId: REVISION, note: " " });

    expect(result.error).toMatch(/Write why/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("sends a low costing with its reason to the approvers", async () => {
    const calls = database(revisionRow({ cost: 80, status: "returned" }));

    const result = await sendCosting({
      revisionId: REVISION,
      note: "Matching a competitor",
    });

    expect(result.error).toBeNull();
    expect(find(calls, "quote_revisions", "update")[0].payload).toEqual({
      status: "submitted",
    });
    expect(find(calls, "quote_revision_history", "insert")[0].payload).toEqual({
      revision_id: REVISION,
      action: "submitted",
      note: "Matching a competitor",
    });
  });

  it("does not let a line with no cost keyed pass as a high margin", async () => {
    const calls = database(revisionRow({ cost: null }));

    const refused = await sendCosting({ revisionId: REVISION, note: "" });
    expect(refused.error).toMatch(/Write why/);
    expect(writes(calls)).toHaveLength(0);

    await sendCosting({ revisionId: REVISION, note: "Cost to follow" });
    expect(find(calls, "quote_revisions", "update")[0].payload).toEqual({
      status: "submitted",
    });
  });

  it("refuses someone else's costing, even for the MD", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = database(revisionRow({ owner: OTHER }));

    const result = await sendCosting({ revisionId: REVISION, note: "x" });

    expect(result.error).toMatch(/Only the salesperson/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("reports a costing that changed under the person and logs nothing", async () => {
    const calls = database(revisionRow(), []);

    const result = await sendCosting({ revisionId: REVISION, note: "" });

    expect(result.error).toMatch(/changed while you had it open/);
    expect(find(calls, "quote_revision_history", "insert")).toHaveLength(0);
  });
});

describe("approveCosting and returnCosting", () => {
  it.each([
    "md",
    "director",
  ] as const)("the %s approves a waiting costing", async (jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    const calls = database(
      revisionRow({ owner: OTHER, status: "submitted", cost: 80 }),
    );

    const result = await approveCosting({
      revisionId: REVISION,
      note: "Fine this once",
    });

    expect(result.error).toBeNull();
    expect(find(calls, "quote_revisions", "update")[0].payload).toEqual({
      status: "approved",
    });
    expect(
      find(calls, "quote_revision_history", "insert")[0].payload,
    ).toMatchObject({
      action: "approved",
      note: "Fine this once",
    });
  });

  it.each([
    "sales",
    "bd",
    "accounts",
    "support",
  ] as const)("a %s cannot approve", async (jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    const calls = database(revisionRow({ owner: OTHER, status: "submitted" }));

    const result = await approveCosting({ revisionId: REVISION, note: "" });

    expect(result.error).toMatch(/MD or Sales Director/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("the MD may approve their own costing, as in the demo", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = database(revisionRow({ status: "submitted", cost: 80 }));

    const result = await approveCosting({ revisionId: REVISION, note: "" });

    expect(result.error).toBeNull();
    expect(find(calls, "quote_revisions", "update")[0].payload).toEqual({
      status: "approved",
    });
  });

  it("a return needs a note", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    const calls = database(revisionRow({ owner: OTHER, status: "submitted" }));

    const result = await returnCosting({ revisionId: REVISION, note: "" });

    expect(result.error).toMatch(/what needs changing/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("returns a waiting costing with the note", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    const calls = database(revisionRow({ owner: OTHER, status: "submitted" }));

    const result = await returnCosting({
      revisionId: REVISION,
      note: "Recheck freight",
    });

    expect(result.error).toBeNull();
    expect(find(calls, "quote_revisions", "update")[0].payload).toEqual({
      status: "returned",
    });
    expect(
      find(calls, "quote_revision_history", "insert")[0].payload,
    ).toMatchObject({
      action: "returned",
      note: "Recheck freight",
    });
  });

  it("refuses to approve a draft", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = database(revisionRow({ owner: OTHER, status: "draft" }));

    const result = await approveCosting({ revisionId: REVISION, note: "" });

    expect(result.error).toMatch(/waiting for approval/);
    expect(writes(calls)).toHaveLength(0);
  });
});

describe("chooseOption", () => {
  it("records the customer's option on an approved costing", async () => {
    const calls = database(revisionRow({ status: "approved" }));

    const result = await chooseOption({
      revisionId: REVISION,
      optionId: OPTION_B,
    });

    expect(result.error).toBeNull();
    expect(find(calls, "quote_revisions", "update")[0].payload).toEqual({
      chosen_option_id: OPTION_B,
    });
    expect(
      find(calls, "quote_revision_history", "insert")[0].payload,
    ).toMatchObject({
      action: "chosen",
      note: "Option B",
    });
  });

  it("refuses an option from another costing", async () => {
    const calls = database(revisionRow({ status: "approved" }));

    const result = await chooseOption({
      revisionId: REVISION,
      optionId: NEW_REVISION,
    });

    expect(result.error).toMatch(/Could not find/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("refuses before it is OK to quote", async () => {
    const calls = database(revisionRow({ status: "draft" }));

    const result = await chooseOption({
      revisionId: REVISION,
      optionId: OPTION_A,
    });

    expect(result.error).toMatch(/OK to quote/);
    expect(writes(calls)).toHaveLength(0);
  });
});

describe("openRevision", () => {
  it("opens the next version as a draft copy of the rates, options and lines", async () => {
    const newOptions = [
      "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1",
      "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2",
    ];
    const copyIds = [
      "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1",
      "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2",
    ];
    const lineCopies = [...copyIds];
    const calls = fakeSupabase((call) => {
      if (call.table === "app_settings") return ok([{ value: 30 }]);
      if (call.table === "quote_revisions" && call.op === "select") {
        return ok(revisionRow({ status: "approved", rev: 1, revs: [0, 1] }));
      }
      if (call.table === "quote_revisions") return ok({ id: NEW_REVISION });
      if (call.table === "quote_options") return ok({ id: newOptions.shift() });
      if (call.table === "quote_items" && call.op === "select") {
        const from = call.filters.find(
          ([column]) => column === "option_id",
        )?.[1];
        return ok(
          from === OPTION_A
            ? [
                line(CARPET),
                line(FITTING, { position: 1, linked_item_id: CARPET }),
              ]
            : [],
        );
      }
      if (call.table === "quote_items" && call.op === "insert") {
        return ok({ id: lineCopies.shift() });
      }
      return ok();
    });

    const result = await openRevision({ revisionId: REVISION });

    expect(result).toEqual({ error: null, rev: 2 });
    expect(find(calls, "quote_revisions", "insert")[0].payload).toEqual({
      quote_id: QUOTE,
      rev: 2,
      status: "draft",
      fx_usd: 4.6,
      fx_rmb: 0.62,
      sst_pct: 8,
      target_margin_pct: 35,
    });
    expect(find(calls, "quote_revision_history", "insert")[0].payload).toEqual({
      revision_id: NEW_REVISION,
      action: "revised",
      note: "Copied from Q100-R1",
    });
    expect(
      find(calls, "quote_options", "insert").map((call) => call.payload),
    ).toEqual([
      { revision_id: NEW_REVISION, key: "A", label: "Wool" },
      { revision_id: NEW_REVISION, key: "B", label: "Nylon" },
    ]);
    const copied = find(calls, "quote_items", "insert").map(
      (call) => call.payload,
    );
    expect(copied).toHaveLength(2);
    expect(copied[0]).toMatchObject({
      cost: 60,
      rate: 100,
      linked_item_id: null,
    });
    expect(copied[0]).not.toHaveProperty("id");
    const [link] = find(calls, "quote_items", "update");
    // The copied fitting line follows the copied carpet, not the original.
    expect(link.payload).toEqual({ linked_item_id: copyIds[0] });
    expect(link.filters).toContainEqual(["id", copyIds[1]]);
  });

  it("refuses a new version from an older one", async () => {
    const calls = database(
      revisionRow({ status: "approved", rev: 0, revs: [0, 1] }),
    );

    const result = await openRevision({ revisionId: REVISION });

    expect(result.error).toMatch(/newer version/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("refuses a costing that is not OK to quote", async () => {
    const calls = database(revisionRow({ status: "returned" }));

    const result = await openRevision({ revisionId: REVISION });

    expect(result.error).toMatch(/OK to quote/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("says so when another tab opened the version first", async () => {
    fakeSupabase((call) => {
      if (call.table === "app_settings") return ok([{ value: 30 }]);
      if (call.table === "quote_revisions" && call.op === "select") {
        return ok(revisionRow({ status: "approved" }));
      }
      return { data: null, error: { code: "23505" } };
    });

    const result = await openRevision({ revisionId: REVISION });

    expect(result.error).toMatch(/already opened/);
  });
});
