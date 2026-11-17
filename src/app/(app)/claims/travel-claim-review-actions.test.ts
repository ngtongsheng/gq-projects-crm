import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  releaseTravelClaim,
  returnTravelClaim,
  saveTravelClaimCheck,
} from "./travel-claim-review-actions";

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
vi.mock("@/lib/format/date", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/format/date")>()),
  todayMyt: () => "2026-11-17",
}));

const CLAIM = "33333333-3333-4333-8333-333333333333";
const JANY = "22222222-2222-4222-8222-222222222222";
const MEI = "11111111-1111-4111-8111-111111111111";

const profile = (jobRole: Profile["jobRole"], id = JANY): Profile => ({
  id,
  fullName: "Jany",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
});

const written: { row: Record<string, unknown>; status: unknown }[] = [];

/** A database holding one claim worth RM 300 in `status`; the update answers with `outcome`. */
function givenClaim(
  status: string,
  outcome: {
    error?: { code: string; message: string };
    rows?: number;
  } = {},
  extra: Record<string, unknown> = {},
) {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              profile_id: MEI,
              status,
              petrol_parking_toll: "120.50",
              outstation: null,
              hotel: "179.50",
              others: null,
              overtime: null,
              verified_with_vicky_on: null,
              ...extra,
            },
            error: null,
          }),
        }),
      }),
      update: (row: Record<string, unknown>) => ({
        eq: () => ({
          eq: (_column: string, expected: unknown) => ({
            select: async () => {
              written.push({ row, status: expected });
              return outcome.error
                ? { data: null, error: outcome.error }
                : {
                    data: Array.from({ length: outcome.rows ?? 1 }, () => ({
                      id: CLAIM,
                    })),
                    error: null,
                  };
            },
          }),
        }),
      }),
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  written.length = 0;
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
});

describe("travel claim check and release", () => {
  it("only the MD and HR & Accounts check a claim", async () => {
    givenClaim("submitted");
    for (const jobRole of ["sales", "director", "site"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
      const result = await releaseTravelClaim(CLAIM, form({}));
      expect(result.error).toMatch(/Only HR & Accounts or the MD/);
    }
    expect(written).toEqual([]);

    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    expect(await releaseTravelClaim(CLAIM, form({}))).toEqual({ error: null });
  });

  it("nobody checks their own claim", async () => {
    givenClaim("submitted", {}, { profile_id: JANY });
    const result = await releaseTravelClaim(CLAIM, form({}));
    expect(result.error).toMatch(/never their own/);
    expect(written).toEqual([]);
  });

  it("Save keeps the claim submitted and stores amount, note and Vicky tick", async () => {
    givenClaim("submitted");
    const result = await saveTravelClaimCheck(
      CLAIM,
      form({
        finalAmount: "250",
        finalNote: "  No toll receipt  ",
        verifiedWithVicky: "on",
      }),
    );
    expect(result).toEqual({ error: null });
    expect(written).toEqual([
      {
        status: "submitted",
        row: {
          final_amount: 250,
          final_note: "No toll receipt",
          verified_with_vicky_on: "2026-11-17",
          status: "submitted",
        },
      },
    ]);
  });

  it("stores no final amount when it is blank or equals the total", async () => {
    givenClaim("submitted");
    await saveTravelClaimCheck(CLAIM, form({ finalAmount: "300" }));
    await saveTravelClaimCheck(CLAIM, form({ finalAmount: "" }));
    expect(written.map((entry) => entry.row.final_amount)).toEqual([
      null,
      null,
    ]);
  });

  it("keeps the first Vicky date and clears it when unticked", async () => {
    givenClaim("submitted", {}, { verified_with_vicky_on: "2026-11-10" });
    await saveTravelClaimCheck(CLAIM, form({ verifiedWithVicky: "on" }));
    await saveTravelClaimCheck(CLAIM, form({}));
    expect(written.map((entry) => entry.row.verified_with_vicky_on)).toEqual([
      "2026-11-10",
      null,
    ]);
  });

  it("Return sends it back as a draft with the note", async () => {
    givenClaim("submitted");
    await returnTravelClaim(
      CLAIM,
      form({ finalNote: "Attach the TNG statement" }),
    );
    expect(written[0]?.row).toMatchObject({
      status: "draft",
      final_note: "Attach the TNG statement",
    });
  });

  it("Release moves a submitted claim to released", async () => {
    givenClaim("submitted");
    await releaseTravelClaim(CLAIM, form({}));
    expect(written[0]?.row.status).toBe("released");
  });

  it("release without the monthly report shows a plain message", async () => {
    givenClaim("submitted", {
      error: { code: "42501", message: "Monthly report not submitted yet." },
    });
    expect(await releaseTravelClaim(CLAIM, form({}))).toEqual({
      error: "Monthly report not submitted yet",
    });
  });

  it("a released or returned claim cannot be checked again", async () => {
    for (const status of ["released", "draft"]) {
      givenClaim(status);
      const result = await releaseTravelClaim(CLAIM, form({}));
      expect(result.error).toMatch(/no longer waiting/);
    }
    expect(written).toEqual([]);
  });

  it("says so when the claim moved on while the sheet was open", async () => {
    givenClaim("submitted", { rows: 0 });
    expect((await releaseTravelClaim(CLAIM, form({}))).error).toMatch(
      /no longer waiting/,
    );
  });

  it("refuses a bad final amount", async () => {
    givenClaim("submitted");
    expect(
      (await saveTravelClaimCheck(CLAIM, form({ finalAmount: "-1" }))).error,
    ).toBe("Enter each amount as RM 0 or more.");
    expect(written).toEqual([]);
  });
});
