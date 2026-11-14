import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  addOption,
  removeOption,
  saveRevision,
  startOriginalRevision,
} from "./revision-actions";
import type { RevisionPayload } from "./revision-input";

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
const TRANSPORT = "99999999-9999-4999-8999-999999999999";
const NEW_ITEM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const profile = (seesMargin: boolean): Profile => ({
  id: ME,
  fullName: "Ah Kow",
  role: "staff",
  jobRole: "sales",
  arrangesStock: false,
  sells: false,
  seesMargin,
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
  delete: () => Chain;
  eq: (column: string, value: unknown) => Chain;
  in: (column: string, value: unknown) => Chain;
  order: () => Chain;
  limit: () => Chain;
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
      // Answered once the whole chain has been built, so the call is complete when it is read.
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
          delete: () => {
            call.op = "delete";
            return query;
          },
          eq: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return query;
          },
          in: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return query;
          },
          order: () => query,
          limit: () => query,
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

const revisionRow = (overrides: { status?: string; owner?: string } = {}) => ({
  id: REVISION,
  quote_id: QUOTE,
  status: overrides.status ?? "draft",
  quotes: { salesperson_id: overrides.owner ?? ME },
  quote_options: [
    {
      id: OPTION_A,
      key: "A",
      quote_items: [
        { id: CARPET, type: "local" },
        { id: TRANSPORT, type: "lump" },
      ],
    },
  ],
});

const emptyItem = {
  id: null,
  ref: "x",
  linkRef: null,
  category: "si",
  type: "local",
  area: null,
  product: null,
  supplier: null,
  description: null,
  remark: null,
  unit: "m2",
  qty: null,
  rate: null,
  material: null,
  wastagePct: null,
  underlay: null,
  accessories: null,
  install: null,
  currency: null,
  fob: null,
  fx: null,
  sstPct: null,
  shipping: null,
  rugMode: null,
  length: null,
  width: null,
  pieceCost: null,
  edging: null,
  lumpCost: null,
} as const;

const payload = (
  items: Partial<RevisionPayload["options"][number]["items"][number]>[],
  extra: Partial<RevisionPayload> = {},
): RevisionPayload => ({
  revisionId: REVISION,
  fxUsd: 4.6,
  fxRmb: 0.62,
  sstPct: 8,
  targetMarginPct: 35,
  options: [
    {
      id: OPTION_A,
      label: "Axminster",
      items: items.map((item) => ({ ...emptyItem, ...item })),
    },
  ],
  ...extra,
});

/** The revision loads as given; every write succeeds and an insert answers with NEW_ITEM. */
function happyDatabase(row = revisionRow()) {
  return fakeSupabase((call) => {
    if (call.table === "quote_revisions" && call.op === "select") {
      return ok(row);
    }
    if (call.op === "insert") return ok({ id: NEW_ITEM });
    return ok();
  });
}

const writes = (calls: Call[]) => calls.filter((call) => call.op !== "select");
const find = (calls: Call[], table: string, op: Call["op"]) =>
  calls.filter((call) => call.table === table && call.op === op);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile(true));
});

describe("saveRevision", () => {
  it("refuses to change an approved costing", async () => {
    const calls = happyDatabase(revisionRow({ status: "approved" }));

    const result = await saveRevision(
      payload([{ id: CARPET, ref: CARPET, qty: 5 }]),
    );

    expect(result.error).toMatch(/approved costing is locked/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("refuses someone else's costing", async () => {
    const calls = happyDatabase(revisionRow({ owner: OTHER }));

    const result = await saveRevision(payload([]));

    expect(result.error).toMatch(/Only the salesperson who owns/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("writes only what was keyed in; totals sent by the browser are never stored", async () => {
    const calls = happyDatabase();
    const forged = {
      ...emptyItem,
      id: CARPET,
      ref: CARPET,
      material: 10,
      qty: 5,
      rate: 20,
      sell: 99999,
      margin: 0.99,
      profit: 1,
    };

    const result = await saveRevision(
      payload([forged], { sell: 1, margin: 1 } as Partial<RevisionPayload>),
    );

    expect(result.error).toBeNull();
    const [line] = find(calls, "quote_items", "update");
    expect(line.payload).toEqual({
      category: "si",
      type: "local",
      area: null,
      product: null,
      supplier: null,
      description: null,
      remark: null,
      unit: "m2",
      qty: 5,
      rate: 20,
      material: 10,
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
      cost: null,
      position: 0,
      linked_item_id: null,
    });
    const [revision] = find(calls, "quote_revisions", "update");
    expect(revision.payload).toEqual({
      status: "draft",
      fx_usd: 4.6,
      fx_rmb: 0.62,
      sst_pct: 8,
      target_margin_pct: 35,
    });
  });

  it("removes lines that are no longer in the editor and adds new ones in order", async () => {
    const calls = happyDatabase();

    await saveRevision(
      payload([
        { ...emptyItem, ref: "new", product: "  Underlay  ", qty: 3 },
        { id: CARPET, ref: CARPET },
      ]),
    );

    expect(find(calls, "quote_items", "delete")[0].filters).toContainEqual([
      "id",
      [TRANSPORT],
    ]);
    const [added] = find(calls, "quote_items", "insert");
    expect(added.payload).toMatchObject({
      option_id: OPTION_A,
      position: 0,
      product: "Underlay",
      qty: 3,
    });
    expect(find(calls, "quote_items", "update")[0].payload).toMatchObject({
      position: 1,
    });
  });

  it("links an installation line to a line added in the same save", async () => {
    const calls = happyDatabase();

    await saveRevision(
      payload([
        { ref: "carpet-new", product: "Carpet" },
        {
          ref: "install-new",
          category: "install",
          type: "labour",
          linkRef: "carpet-new",
        },
      ]),
    );

    const links = find(calls, "quote_items", "update");
    expect(links).toHaveLength(1);
    expect(links[0].payload).toEqual({ linked_item_id: NEW_ITEM });
  });

  describe("without the margin flag", () => {
    beforeEach(() => {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(false));
    });

    it("changes sell-side fields only and leaves rates, SST and cost as keyed", async () => {
      const calls = happyDatabase();

      const result = await saveRevision(
        payload([
          {
            id: CARPET,
            ref: CARPET,
            product: "Carpet",
            qty: 5,
            rate: 20,
            material: 1,
            wastagePct: 50,
          },
        ]),
      );

      expect(result.error).toBeNull();
      const [revision] = find(calls, "quote_revisions", "update");
      expect(revision.payload).toEqual({ status: "draft" });
      const [line] = find(calls, "quote_items", "update");
      expect(line.payload).toEqual({
        category: "si",
        area: null,
        product: "Carpet",
        supplier: null,
        description: null,
        remark: null,
        unit: "m2",
        qty: 5,
        rate: 20,
        length: null,
        width: null,
        position: 0,
        linked_item_id: null,
      });
    });

    it("stores a new line with no cost even if one is posted", async () => {
      const calls = happyDatabase();

      await saveRevision(
        payload([
          {
            ref: "new",
            type: "import",
            currency: "RMB",
            fob: 9,
            fx: 0.6,
            sstPct: 10,
            shipping: 4,
            material: 3,
          },
        ]),
      );

      const [added] = find(calls, "quote_items", "insert");
      expect(added.payload).toMatchObject({
        type: "import",
        currency: "USD",
        fob: null,
        fx: null,
        sst_pct: null,
        shipping: null,
        material: null,
      });
    });

    it("refuses to change what kind of line a saved line is", async () => {
      const calls = happyDatabase();

      const result = await saveRevision(
        payload([
          { id: CARPET, ref: CARPET, category: "supply", type: "import" },
        ]),
      );

      expect(result.error).toMatch(/Only people who see cost/);
      expect(writes(calls)).toHaveLength(0);
    });
  });

  it("refuses a line or option that is not part of this revision", async () => {
    const calls = happyDatabase();

    const foreignLine = await saveRevision(
      payload([{ id: NEW_ITEM, ref: NEW_ITEM }]),
    );
    const foreignOption = await saveRevision(
      payload([], {
        options: [{ id: OPTION_B, label: "", items: [] }],
      }),
    );

    expect(foreignLine.error).toMatch(/Could not find this costing/);
    expect(foreignOption.error).toMatch(/Could not find this costing/);
    expect(writes(calls)).toHaveLength(0);
  });

  it("refuses numbers the database cannot hold", async () => {
    const calls = happyDatabase();

    const result = await saveRevision(payload([{ ref: "a", qty: -1 }]));

    expect(result.error).toMatch(/not valid/);
    expect(calls).toHaveLength(0);
  });

  it("notes a change to a submitted costing once", async () => {
    const calls = fakeSupabase((call) => {
      if (call.table === "quote_revisions" && call.op === "select") {
        return ok(revisionRow({ status: "submitted" }));
      }
      if (call.table === "quote_revision_history" && call.op === "select") {
        return ok([{ action: "submitted" }]);
      }
      return ok();
    });

    await saveRevision(payload([]));

    expect(find(calls, "quote_revision_history", "insert")[0].payload).toEqual({
      revision_id: REVISION,
      action: "edited",
      note: "Changed after it was submitted",
    });
  });

  it("does not note it again after the first change", async () => {
    const calls = fakeSupabase((call) => {
      if (call.table === "quote_revisions" && call.op === "select") {
        return ok(revisionRow({ status: "submitted" }));
      }
      if (call.table === "quote_revision_history" && call.op === "select") {
        return ok([{ action: "edited" }]);
      }
      return ok();
    });

    await saveRevision(payload([]));

    expect(find(calls, "quote_revision_history", "insert")).toHaveLength(0);
  });

  it("shows a plain message when the database refuses", async () => {
    fakeSupabase((call) => {
      if (call.table === "quote_revisions" && call.op === "select") {
        return ok(revisionRow());
      }
      return { data: null, error: { code: "42501" } };
    });

    const result = await saveRevision(payload([]));

    expect(result.error).toMatch(/can't be changed any more/);
  });
});

describe("addOption", () => {
  it("copies the lines into the next letter and points copied links at the copies", async () => {
    const lineRow = (id: string, link: string | null, position: number) => ({
      ...emptyRow,
      id,
      position,
      linked_item_id: link,
    });
    const copies = [NEW_ITEM, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
    const calls = fakeSupabase((call) => {
      if (call.table === "quote_revisions") return ok(revisionRow());
      if (call.table === "quote_options") return ok({ id: OPTION_B });
      if (call.table === "quote_items" && call.op === "select") {
        return ok([lineRow(CARPET, null, 0), lineRow(TRANSPORT, CARPET, 1)]);
      }
      if (call.op === "insert") return ok({ id: copies.shift() });
      return ok();
    });

    const result = await addOption({
      revisionId: REVISION,
      copyFromOptionId: OPTION_A,
    });

    expect(result).toEqual({ error: null, optionKey: "B" });
    expect(find(calls, "quote_options", "insert")[0].payload).toEqual({
      revision_id: REVISION,
      key: "B",
      label: "",
    });
    const [link] = find(calls, "quote_items", "update");
    expect(link.payload).toEqual({
      linked_item_id: NEW_ITEM,
    });
    expect(link.filters).toContainEqual([
      "id",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ]);
  });

  it("adds an empty Option A to a revision that has none", async () => {
    const calls = fakeSupabase((call) => {
      if (call.table === "quote_revisions") {
        return ok({ ...revisionRow(), quote_options: [] });
      }
      return ok({ id: OPTION_A });
    });

    const result = await addOption({
      revisionId: REVISION,
      copyFromOptionId: null,
    });

    expect(result.optionKey).toBe("A");
    expect(find(calls, "quote_items", "insert")).toHaveLength(0);
  });
});

describe("removeOption", () => {
  it("keeps the last option", async () => {
    fakeSupabase((call) => {
      if (call.table === "quote_options") return ok({ revision_id: REVISION });
      return ok(revisionRow());
    });

    expect(await removeOption({ optionId: OPTION_A })).toEqual({
      error: "A costing keeps at least one option.",
    });
  });

  it("re-letters the options that are left", async () => {
    const row = revisionRow();
    row.quote_options.push({ id: OPTION_B, key: "B", quote_items: [] });
    const calls = fakeSupabase((call) => {
      if (call.table === "quote_options" && call.op === "select") {
        return ok({ revision_id: REVISION });
      }
      if (call.table === "quote_revisions") return ok(row);
      return ok();
    });

    const result = await removeOption({ optionId: OPTION_A });

    expect(result.error).toBeNull();
    const [rename] = find(calls, "quote_options", "update");
    expect(rename.payload).toEqual({ key: "A" });
    expect(rename.filters).toContainEqual(["id", OPTION_B]);
  });
});

describe("startOriginalRevision", () => {
  it("creates the Original draft with Option A and its history line", async () => {
    const calls = fakeSupabase((call) =>
      call.op === "insert" && call.table === "quote_revisions"
        ? ok({ id: REVISION })
        : ok(),
    );

    const result = await startOriginalRevision({ quoteId: QUOTE });

    expect(result.error).toBeNull();
    expect(find(calls, "quote_revisions", "insert")[0].payload).toEqual({
      quote_id: QUOTE,
      rev: 0,
      status: "draft",
    });
    expect(find(calls, "quote_options", "insert")[0].payload).toEqual({
      revision_id: REVISION,
      key: "A",
      label: "",
    });
    expect(find(calls, "quote_revision_history", "insert")[0].payload).toEqual({
      revision_id: REVISION,
      action: "created",
    });
  });

  it("does nothing when the Original already exists", async () => {
    const calls = fakeSupabase(() => ({
      data: null,
      error: { code: "23505" },
    }));

    expect(await startOriginalRevision({ quoteId: QUOTE })).toEqual({
      error: null,
    });
    expect(calls).toHaveLength(1);
  });
});

const emptyRow = {
  category: "si",
  type: "local",
  area: null,
  product: null,
  supplier: null,
  description: null,
  remark: null,
  unit: "m2",
  qty: null,
  rate: null,
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
  cost: null,
};
