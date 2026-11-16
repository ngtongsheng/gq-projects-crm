import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { loadClaimSettings } from "./claim-settings-data";
import { addExpense } from "./expense-actions";

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
  todayMyt: () => "2026-11-27",
}));

const CLAIM = "33333333-3333-4333-8333-333333333333";
const EXPENSE = "44444444-4444-4444-8444-444444444444";
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
  claimInserts: Record<string, unknown>[];
  expenseInserts: Record<string, unknown>[];
} = { claimInserts: [], expenseInserts: [] };

/** A database with one existing claim in `existing` status (or none), recording what is written. */
function givenClaim(existing: string | null) {
  const claims = (insert: boolean) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: existing ? { id: CLAIM, status: existing } : null,
            error: null,
          }),
        }),
      }),
      single: async () => ({
        data: insert ? { id: CLAIM, status: "draft" } : null,
        error: null,
      }),
    }),
  });
  const client = {
    from: (table: string) => {
      if (table === "monthly_claims") {
        return {
          ...claims(false),
          insert: (row: Record<string, unknown>) => {
            calls.claimInserts.push(row);
            return claims(true);
          },
        };
      }
      return {
        insert: (row: Record<string, unknown>) => {
          calls.expenseInserts.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: EXPENSE }, error: null }),
            }),
          };
        },
      };
    },
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
};

const petrol = {
  spentOn: "2026-11-10",
  expenseType: "petrol",
  description: "Office to site",
  amount: "45.50",
};

beforeEach(() => {
  vi.resetAllMocks();
  calls.claimInserts = [];
  calls.expenseInserts = [];
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
  vi.mocked(loadClaimSettings).mockResolvedValue({
    cutOffDay: 25,
    mileageRatePerKm: 0.6,
    kmPerDay: 150,
    monthlyTravelLimit: 0,
    needReport: true,
  });
});

describe("addExpense", () => {
  it("starts the claim of the month the date belongs to and adds the line", async () => {
    givenClaim(null);
    const result = await addExpense(form(petrol));
    expect(result).toEqual({
      error: null,
      claimId: CLAIM,
      expenseId: EXPENSE,
      monthLabel: "Nov 2026",
    });
    expect(calls.claimInserts).toEqual([{ month: "2026-11-01" }]);
    expect(calls.expenseInserts[0]).toMatchObject({
      claim_id: CLAIM,
      spent_on: "2026-11-10",
      expense_type: "petrol",
      amount: 45.5,
    });
  });

  it("puts a date after the cut-off day into next month's claim", async () => {
    givenClaim(null);
    await addExpense(form({ ...petrol, spentOn: "2026-11-26" }));
    expect(calls.claimInserts).toEqual([{ month: "2026-12-01" }]);
  });

  it("refuses to add to a claim already with HR & Accounts", async () => {
    givenClaim("submitted");
    const result = await addExpense(form(petrol));
    expect(result.error).toMatch(/already submitted/);
    expect(calls.expenseInserts).toEqual([]);
  });

  it("refuses a day that has not come", async () => {
    givenClaim(null);
    const result = await addExpense(form({ ...petrol, spentOn: "2026-11-28" }));
    expect(result.error).toBe("You cannot claim for a day that has not come.");
  });

  it("needs the meals ticked for outstation meals and names them in the line", async () => {
    givenClaim(null);
    const meals = {
      ...petrol,
      expenseType: "outstation_meals",
      amount: "30",
    };
    expect((await addExpense(form(meals))).error).toBe("Tick the meals.");
    await addExpense(form({ ...meals, meals: ["lunch", "dinner"] }));
    expect(calls.expenseInserts[0]?.description).toBe(
      "Office to site (Lunch, Dinner)",
    );
  });

  it("leaves a mileage amount to the database", async () => {
    givenClaim(null);
    await addExpense(
      form({ ...petrol, expenseType: "mileage", amount: "", km: "40" }),
    );
    expect(calls.expenseInserts[0]).toMatchObject({ km: 40, amount: null });
  });

  it("is refused for a role that files no claim", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenClaim(null);
    const result = await addExpense(form(petrol));
    expect(result.error).toBe("Your role does not file a monthly claim.");
  });
});
