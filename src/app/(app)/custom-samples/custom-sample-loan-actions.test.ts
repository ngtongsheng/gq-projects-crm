import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  confirmCustomSampleBack,
  giveAwayCustomSample,
  markCustomSampleReturned,
  rejectCustomSampleReturn,
} from "./custom-sample-loan-actions";
import { saveCustomSampleLoanDays } from "./custom-sample-settings-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
vi.mock("@/lib/format/date", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/format/date")>()),
  todayMyt: () => "2026-11-17",
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
const SAMPLE = "33333333-3333-4333-8333-333333333333";

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

type Write = {
  table: string;
  row: Record<string, unknown>;
  filters: string[];
};
const writes: Write[] = [];

/** A database that records each write with its filters and answers with `outcome`. */
function givenDatabase(
  outcome: {
    data?: unknown[];
    error?: { code: string; message?: string } | null;
  } = {},
) {
  const answer = {
    data: outcome.data ?? [{ id: SAMPLE }],
    error: outcome.error ?? null,
  };
  const write = (table: string, row: Record<string, unknown>) => {
    const filters: string[] = [];
    writes.push({ table, row, filters });
    const filter = (label: string) => (column: string) => {
      filters.push(`${label} ${column}`);
      return done;
    };
    const done = {
      eq: filter("eq"),
      is: filter("is null"),
      not: filter("not null"),
      select: () => Promise.resolve(answer),
    };
    return Object.assign(Promise.resolve(answer), done);
  };
  vi.mocked(createClient).mockResolvedValue({
    from: (table: string) => ({
      update: (row: Record<string, unknown>) => write(table, row),
      upsert: (row: Record<string, unknown>) => write(table, row),
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

beforeEach(() => {
  vi.resetAllMocks();
  writes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("designer"));
});

describe("markCustomSampleReturned", () => {
  it("stamps today on the open loan, once", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    givenDatabase();
    expect(await markCustomSampleReturned(SAMPLE)).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "custom_sample_loans",
        row: { returned_marked_on: "2026-11-17" },
        filters: [
          "eq sample_id",
          "is null back_on",
          "is null returned_marked_on",
        ],
      },
    ]);
  });

  it("says so when the loan is closed or already marked", async () => {
    givenDatabase({ data: [] });
    expect((await markCustomSampleReturned(SAMPLE)).error).toMatch(
      /not out on loan/,
    );
  });

  it("passes on the database's refusal for someone who is not the borrower", async () => {
    givenDatabase({
      error: {
        code: "42501",
        message: "Only the borrower marks the sample returned.",
      },
    });
    expect((await markCustomSampleReturned(SAMPLE)).error).toBe(
      "Only the borrower marks the sample returned.",
    );
  });
});

describe("confirmCustomSampleBack", () => {
  it("takes the sample back today, whether or not the borrower marked it", async () => {
    givenDatabase();
    expect(await confirmCustomSampleBack(SAMPLE)).toEqual({ error: null });
    expect(writes[0]).toMatchObject({
      row: { back_on: "2026-11-17" },
      filters: ["eq sample_id", "is null back_on"],
    });
  });

  it("is only for the office", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    givenDatabase();
    expect((await confirmCustomSampleBack(SAMPLE)).error).toMatch(/office/);
    expect(writes).toEqual([]);
  });
});

describe("rejectCustomSampleReturn", () => {
  it("clears the borrower's mark so the sample is on loan again", async () => {
    givenDatabase();
    expect(await rejectCustomSampleReturn(SAMPLE)).toEqual({ error: null });
    expect(writes[0]).toMatchObject({
      row: { returned_marked_on: null },
      filters: [
        "eq sample_id",
        "is null back_on",
        "not null returned_marked_on",
      ],
    });
  });

  it("is only for the office", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await rejectCustomSampleReturn(SAMPLE)).error).toMatch(/office/);
    expect(writes).toEqual([]);
  });

  it("explains when nobody had marked a return", async () => {
    givenDatabase({ data: [] });
    expect((await rejectCustomSampleReturn(SAMPLE)).error).toMatch(
      /not out on loan/,
    );
  });
});

describe("giveAwayCustomSample", () => {
  const input = {
    sampleId: SAMPLE,
    givenTo: " Hotel Seri ",
    reason: " client confirmed the order ",
  };

  it("records who and why, only on a sample not given away yet", async () => {
    givenDatabase();
    expect(await giveAwayCustomSample(input)).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "custom_samples",
        row: {
          given_to: "Hotel Seri",
          gift_reason: "client confirmed the order",
        },
        filters: ["eq id", "is null given_on"],
      },
    ]);
  });

  it("needs a customer and a reason of at least 5 characters", async () => {
    givenDatabase();
    const message = "Key in who it was given to and the reason.";
    expect((await giveAwayCustomSample({ ...input, givenTo: " " })).error).toBe(
      message,
    );
    expect(
      (await giveAwayCustomSample({ ...input, reason: "yes" })).error,
    ).toBe(message);
    expect(writes).toEqual([]);
  });

  it("refuses a sample that is already given away", async () => {
    givenDatabase({ data: [] });
    expect((await giveAwayCustomSample(input)).error).toMatch(
      /already given away/,
    );
  });

  it("passes on the database's own wording, e.g. for a stranger", async () => {
    givenDatabase({
      error: {
        code: "42501",
        message: "Only the office or the borrower gives a sample away.",
      },
    });
    expect((await giveAwayCustomSample(input)).error).toBe(
      "Only the office or the borrower gives a sample away.",
    );
  });
});

describe("saveCustomSampleLoanDays", () => {
  const form = (days: string) => {
    const data = new FormData();
    data.set("loanDays", days);
    return data;
  };

  it("saves the loan period under the custom samples setting", async () => {
    givenDatabase();
    expect(await saveCustomSampleLoanDays(form(" 21 "))).toEqual({
      error: null,
    });
    expect(writes).toEqual([
      {
        table: "app_settings",
        row: { key: "customSamples", value: { loanDays: 21 } },
        filters: [],
      },
    ]);
  });

  it.each(["0", "1.5", "", "abc", "366"])("refuses %j days", async (days) => {
    givenDatabase();
    expect((await saveCustomSampleLoanDays(form(days))).error).toMatch(
      /Loan period|365/,
    );
    expect(writes).toEqual([]);
  });

  it("is only for the office", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    givenDatabase();
    expect((await saveCustomSampleLoanDays(form("14"))).error).toMatch(
      /office/,
    );
    expect(writes).toEqual([]);
  });
});
