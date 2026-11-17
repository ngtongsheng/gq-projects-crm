import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  borrowCustomSample,
  deleteCustomSample,
  saveCustomSample,
} from "./custom-sample-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
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
const VERNICE = "22222222-2222-4222-8222-222222222222";
const SAMPLE = "33333333-3333-4333-8333-333333333333";

const profile = (
  jobRole: Profile["jobRole"],
  fields: Partial<Profile> = {},
): Profile => ({
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
  ...fields,
});

type Write = { table: string; row?: Record<string, unknown> };
const writes: Write[] = [];

/** A database that records writes and answers each one with `outcome`. */
function givenDatabase(
  outcome: {
    data?: unknown;
    error?: { code: string; message?: string } | null;
  } = {},
) {
  const answer = {
    data: outcome.data ?? [{ id: SAMPLE }],
    error: outcome.error ?? null,
  };
  const chain = (table: string, row?: Record<string, unknown>) => {
    writes.push({ table, row });
    const done = {
      eq: () => done,
      select: () =>
        Object.assign(Promise.resolve(answer), {
          single: async () => ({
            ...answer,
            data: outcome.data ?? { due_on: "2026-12-01" },
          }),
        }),
    };
    return done;
  };
  const client = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => chain(table, row),
      update: (row: Record<string, unknown>) => chain(table, row),
      delete: () => chain(table),
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

const record = {
  id: SAMPLE,
  editing: false,
  code: "",
  receivedOn: "2026-11-17",
  designName: "  Botanical swirl ",
  designNo: "GQ-HT-2611",
  supplier: "",
  size: "50 x 50 cm",
  qty: "",
  notes: "",
  photoPath: null,
};

const borrow = {
  sampleId: SAMPLE,
  salespersonId: null,
  customer: " Hotel Seri ",
  project: "",
  outOn: "2026-11-17",
};

beforeEach(() => {
  vi.resetAllMocks();
  writes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("designer"));
});

describe("saveCustomSample", () => {
  it("records a sample; a blank code is left for the database to number", async () => {
    givenDatabase();
    expect(await saveCustomSample(record)).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "custom_samples",
        row: {
          id: SAMPLE,
          code: null,
          photo_path: null,
          received_on: "2026-11-17",
          design_name: "Botanical swirl",
          design_no: "GQ-HT-2611",
          supplier: null,
          size: "50 x 50 cm",
          qty: 1,
          notes: null,
        },
      },
    ]);
  });

  it("keeps the code and photo it has when an edit leaves them blank", async () => {
    givenDatabase();
    await saveCustomSample({ ...record, editing: true });
    expect(writes[0]?.row).not.toHaveProperty("code");
    expect(writes[0]?.row).not.toHaveProperty("photo_path");
  });

  it("refuses people who do not look after samples", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    givenDatabase();
    expect((await saveCustomSample(record)).error).toMatch(/office/);
    expect(writes).toEqual([]);
  });

  it("asks for the design no., name and date", async () => {
    givenDatabase();
    expect((await saveCustomSample({ ...record, designNo: " " })).error).toBe(
      "Fill in the design no., design name and received date.",
    );
    expect(writes).toEqual([]);
  });

  it("takes a photo only from the sample's own folder", async () => {
    givenDatabase();
    const other =
      "custom-samples/44444444-4444-4444-8444-444444444444/ab-x.jpg";
    expect(
      (await saveCustomSample({ ...record, photoPath: other })).error,
    ).toMatch(/Upload it again/);
    await saveCustomSample({
      ...record,
      photoPath: `custom-samples/${SAMPLE}/ab-x.jpg`,
    });
    expect(writes[0]?.row?.photo_path).toBe(
      `custom-samples/${SAMPLE}/ab-x.jpg`,
    );
  });

  it("names a code that is already used", async () => {
    givenDatabase({ error: { code: "23505" } });
    expect((await saveCustomSample({ ...record, code: "TS-001" })).error).toBe(
      "TS-001 is already used.",
    );
  });
});

describe("deleteCustomSample", () => {
  it("explains why a sample that was lent stays", async () => {
    givenDatabase({ data: [] });
    expect((await deleteCustomSample(SAMPLE)).error).toMatch(/stays on record/);
  });

  it("deletes one never lent", async () => {
    givenDatabase();
    expect(await deleteCustomSample(SAMPLE)).toEqual({ error: null });
    expect(writes).toEqual([{ table: "custom_samples", row: undefined }]);
  });
});

describe("borrowCustomSample", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
  });

  it("lends to the salesperson themselves and returns the due date", async () => {
    givenDatabase();
    expect(
      await borrowCustomSample({ ...borrow, salespersonId: VERNICE }),
    ).toEqual({
      error: null,
      dueOn: "2026-12-01",
    });
    expect(writes).toEqual([
      {
        table: "custom_sample_loans",
        row: {
          sample_id: SAMPLE,
          salesperson_id: ME,
          customer: "Hotel Seri",
          project: null,
          out_on: "2026-11-17",
        },
      },
    ]);
  });

  it("lets a designer, who does not sell, look but not borrow", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("designer"));
    givenDatabase();
    expect((await borrowCustomSample(borrow)).error).toMatch(/salesperson/);
    expect(writes).toEqual([]);
  });

  it("makes the MD choose a salesperson", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    givenDatabase();
    expect((await borrowCustomSample(borrow)).error).toBe(
      "Choose the salesperson.",
    );
    await borrowCustomSample({ ...borrow, salespersonId: VERNICE });
    expect(writes[0]?.row?.salesperson_id).toBe(VERNICE);
  });

  it("lets a salesperson from another role borrow when they sell", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(
      profile("support", { sells: true }),
    );
    givenDatabase();
    await borrowCustomSample(borrow);
    expect(writes[0]?.row?.salesperson_id).toBe(ME);
  });

  it("needs the customer", async () => {
    givenDatabase();
    expect((await borrowCustomSample({ ...borrow, customer: " " })).error).toBe(
      "Key in the customer.",
    );
  });

  it("says when the sample is already out", async () => {
    givenDatabase({ error: { code: "23505" } });
    expect((await borrowCustomSample(borrow)).error).toBe("Already on loan.");
  });

  it("passes on the database's own wording of a refusal", async () => {
    givenDatabase({
      error: { code: "42501", message: "This sample was given away." },
    });
    expect((await borrowCustomSample(borrow)).error).toBe(
      "This sample was given away.",
    );
  });
});
