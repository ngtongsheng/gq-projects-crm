import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { loadClaimSettings } from "./claim-settings-data";
import { submitTravelClaim } from "./travel-claim-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
vi.mock("./claim-settings-data", () => ({ loadClaimSettings: vi.fn() }));
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
const MEI = "11111111-1111-4111-8111-111111111111";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: MEI,
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

const calls: {
  finds: { profile_id?: unknown; month?: unknown }[];
  inserts: Record<string, unknown>[];
  updates: { row: Record<string, unknown>; id: unknown }[];
} = { finds: [], inserts: [], updates: [] };

/** A database with one existing claim in `existing` status (or none), recording what is written. */
function givenClaim(
  existing: string | null,
  insertError: { code: string } | null = null,
) {
  const client = {
    from: (table: string) => {
      expect(table).toBe("travel_claims");
      return {
        select: () => {
          const filters: { profile_id?: unknown; month?: unknown } = {};
          calls.finds.push(filters);
          const chain = {
            eq: (column: "profile_id" | "month", value: unknown) => {
              filters[column] = value;
              return chain;
            },
            maybeSingle: async () => ({
              data: existing ? { id: CLAIM, status: existing } : null,
              error: null,
            }),
          };
          return chain;
        },
        insert: async (row: Record<string, unknown>) => {
          calls.inserts.push(row);
          return { error: insertError };
        },
        update: (row: Record<string, unknown>) => ({
          eq: (_column: string, id: unknown) => ({
            select: async () => {
              calls.updates.push({ row, id });
              return { data: [{ id: CLAIM }], error: null };
            },
          }),
        }),
      };
    },
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

const nov = {
  month: "2026-11-01",
  petrolParkingToll: "320.50",
  outstation: "",
  hotel: "180",
  others: "",
  othersDescription: "",
  overtime: "",
  remark: "  Two trips to Ipoh  ",
};

beforeEach(() => {
  vi.resetAllMocks();
  calls.finds = [];
  calls.inserts = [];
  calls.updates = [];
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
  vi.mocked(loadClaimSettings).mockResolvedValue({
    cutOffDay: 25,
    mileageRatePerKm: 0.6,
    kmPerDay: 150,
    monthlyTravelLimit: 0,
    needReport: true,
  });
});

describe("submitTravelClaim", () => {
  it("starts the claim as submitted; blanks are stored as not keyed in", async () => {
    givenClaim(null);
    expect(await submitTravelClaim(form(nov))).toEqual({
      error: null,
      updated: false,
    });
    expect(calls.inserts).toEqual([
      {
        month: "2026-11-01",
        petrol_parking_toll: 320.5,
        outstation: null,
        hotel: 180,
        others: null,
        others_description: null,
        overtime: null,
        remark: "Two trips to Ipoh",
        status: "submitted",
      },
    ]);
  });

  it("looks only for the signed-in person's own claim", async () => {
    givenClaim(null);
    await submitTravelClaim(form(nov));
    expect(calls.finds).toEqual([{ profile_id: MEI, month: "2026-11-01" }]);
  });

  it("submits a draft claim", async () => {
    givenClaim("draft");
    expect(await submitTravelClaim(form(nov))).toEqual({
      error: null,
      updated: false,
    });
    expect(calls.updates[0]).toMatchObject({
      id: CLAIM,
      row: { status: "submitted" },
    });
    expect(calls.inserts).toEqual([]);
  });

  it("updates a claim already with Jany and keeps it submitted", async () => {
    givenClaim("submitted");
    expect(await submitTravelClaim(form(nov))).toEqual({
      error: null,
      updated: true,
    });
    expect(calls.updates[0]?.row.status).toBe("submitted");
  });

  it("updates the claim another tab just started", async () => {
    givenClaim("submitted", { code: "23505" });
    expect(await submitTravelClaim(form(nov))).toEqual({
      error: null,
      updated: true,
    });
    expect(calls.updates).toHaveLength(1);
  });

  it("refuses a released claim", async () => {
    givenClaim("released");
    const result = await submitTravelClaim(form(nov));
    expect(result.error).toMatch(/released/);
    expect(calls.updates).toEqual([]);
  });

  it("needs at least one amount", async () => {
    givenClaim(null);
    const empty = { ...nov, petrolParkingToll: "", hotel: "0" };
    expect((await submitTravelClaim(form(empty))).error).toBe(
      "Key in at least one amount",
    );
    expect(calls.inserts).toEqual([]);
  });

  it("needs to know what was bought when others is keyed in", async () => {
    givenClaim(null);
    const others = { ...nov, others: "25" };
    expect((await submitTravelClaim(form(others))).error).toBe(
      "Write what was bought",
    );
    await submitTravelClaim(form({ ...others, othersDescription: "Glue" }));
    expect(calls.inserts[0]).toMatchObject({
      others: 25,
      others_description: "Glue",
    });
  });

  it("refuses a negative or non-number amount", async () => {
    givenClaim(null);
    expect((await submitTravelClaim(form({ ...nov, hotel: "-5" }))).error).toBe(
      "Enter each amount as RM 0 or more.",
    );
    expect(
      (await submitTravelClaim(form({ ...nov, hotel: "abc" }))).error,
    ).toBe("Enter each amount as RM 0 or more.");
  });

  it("claims overtime only for a Site Supervisor", async () => {
    givenClaim(null);
    await submitTravelClaim(form({ ...nov, overtime: "90" }));
    expect(calls.inserts[0]?.overtime).toBeNull();

    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    await submitTravelClaim(form({ ...nov, overtime: "90" }));
    expect(calls.inserts[1]?.overtime).toBe(90);
  });

  it("counts overtime as an amount for a Site Supervisor", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    givenClaim(null);
    const onlyOvertime = {
      ...nov,
      petrolParkingToll: "",
      hotel: "",
      overtime: "90",
    };
    expect((await submitTravelClaim(form(onlyOvertime))).error).toBeNull();
  });

  it("accepts only the months the selector offers", async () => {
    givenClaim(null);
    expect(
      (await submitTravelClaim(form({ ...nov, month: "2026-12-01" }))).error,
    ).toBe("Pick a claim month from the list.");
    expect(
      (await submitTravelClaim(form({ ...nov, month: "2026-04-01" }))).error,
    ).toBe("Pick a claim month from the list.");
    expect(
      (await submitTravelClaim(form({ ...nov, month: "2026-06-01" }))).error,
    ).toBeNull();
  });

  it("is refused for a role that files no claim", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenClaim(null);
    const result = await submitTravelClaim(form(nov));
    expect(result.error).toBe("Your role does not file a travel claim.");
    expect(calls.inserts).toEqual([]);
  });
});
