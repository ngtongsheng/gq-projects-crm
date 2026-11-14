import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveCompany, saveContact } from "./actions";

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
const ARUN = "22222222-2222-4222-8222-222222222222";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const CONTACT = "44444444-4444-4444-8444-444444444444";

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

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = { table: string; steps: string[]; payload: unknown };

/** Every query on a table answers with the next queued result; calls are recorded. save_contact answers from the "rpc:save_contact" queue. */
function fakeSupabase(queues: Record<string, Result[]>) {
  const calls: Call[] = [];
  const client = {
    rpc: vi.fn(async (name: string, payload: unknown) => {
      if (name === "save_contact") {
        calls.push({ table: `rpc:${name}`, steps: [], payload });
        return queues["rpc:save_contact"]?.shift() ?? saved;
      }
      return {
        data: [
          { id: ME, full_name: "Mei" },
          { id: ARUN, full_name: "Arun" },
        ],
        error: null,
      };
    }),
    from: vi.fn((table: string) => {
      const call: Call = { table, steps: [], payload: undefined };
      calls.push(call);
      const result = queues[table]?.shift() ?? {
        data: table === "contact_owners" ? [] : null,
        error: null,
      };
      const query: Record<string, unknown> = {};
      for (const step of [
        "select",
        "insert",
        "update",
        "eq",
        "neq",
        "is",
        "maybeSingle",
        "single",
      ]) {
        query[step] = (payload?: unknown) => {
          const writing = call.steps.some(
            (s) => s === "insert" || s === "update",
          );
          call.steps.push(step);
          if (step === "insert" || step === "update") call.payload = payload;
          if (step === "maybeSingle" || step === "single" || step === "is") {
            return Promise.resolve(result);
          }
          if (step === "select" && writing) {
            return Object.assign(Promise.resolve(result), {
              single: () => Promise.resolve(result),
              maybeSingle: () => Promise.resolve(result),
            });
          }
          return query;
        };
      }
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return calls;
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    companyId: COMPANY,
    name: "Lim Wei",
    mobile: "012-345 6789",
    title: "",
    rating: "3",
    accountType: "own",
    passedBy: "",
    notes: "",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const companyForm = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    companyId: COMPANY,
    name: "Atlas Interiors",
    companyType: "designer",
    rating: "4",
    accountType: "",
    passedBy: "",
    address: "",
    notes: "",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
};

const none: Result = { data: null, error: null };
const saved: Result = { data: CONTACT, error: null };

const savedWith = (calls: Call[]) =>
  calls.filter((call) => call.table === "rpc:save_contact");

describe("saveContact", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("adds a customer with the mobile normalised", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({ contacts: [none] });

    const result = await saveContact(form({}));

    expect(result).toEqual({ error: null, duplicate: null });
    expect(savedWith(calls)[0]?.payload).toMatchObject({
      contact_id: null,
      contact: {
        company_id: COMPANY,
        mobile: "60123456789",
        account_type: "own",
        passed_by: null,
      },
      company: null,
    });
  });

  it("refuses a person who is not one of the company's salespeople", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({
      contact_owners: [
        { data: [{ profile_id: ARUN, contacts: {} }], error: null },
      ],
    });

    const result = await saveContact(form({}));

    expect(result.error).toBe(
      "Only this company's salespeople, the MD or the Sales Director can add people to it.",
    );
    expect(savedWith(calls)).toHaveLength(0);
  });

  it("lets one of the company's salespeople add a person", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({
      contact_owners: [
        {
          data: [
            { profile_id: ARUN, contacts: {} },
            { profile_id: ME, contacts: {} },
          ],
          error: null,
        },
      ],
    });

    const result = await saveContact(form({}));

    expect(result.error).toBeNull();
    expect(savedWith(calls)).toHaveLength(1);
  });

  it("lets the MD add a person to a company they have no people at", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({
      contact_owners: [
        { data: [{ profile_id: ARUN, contacts: {} }], error: null },
      ],
    });

    const result = await saveContact(form({}));

    expect(result.error).toBeNull();
  });

  it("lets the MD change the rating of an existing company", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase({ contacts: [none] });

    const result = await saveContact(form({ rating: "5" }));

    expect(result.error).toBeNull();
    expect(savedWith(calls)[0]?.payload).toMatchObject({
      company: { rating: 5 },
    });
  });

  it("refuses a company rating outside 1 to 5", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase({ contacts: [none] });

    const result = await saveContact(form({ rating: "9" }));

    expect(result.error).toBe("Choose a rating from 1 to 5.");
    expect(savedWith(calls)).toHaveLength(0);
  });

  it("keeps account type fixed to own for people who cannot set it", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({ contacts: [none] });

    await saveContact(form({ accountType: "pass_down", passedBy: ARUN }));

    expect(savedWith(calls)[0]?.payload).toMatchObject({
      contact: { account_type: "own", passed_by: null },
    });
  });

  it("saves a new company in the same call as the customer", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({ contacts: [none] });

    const result = await saveContact(
      form({
        companyId: "new",
        newCompanyName: "Atlas Interiors",
        newCompanyType: "designer",
        rating: "4",
      }),
    );

    expect(result.error).toBeNull();
    expect(calls.some((call) => call.table === "companies")).toBe(false);
    expect(savedWith(calls)).toHaveLength(1);
    expect(savedWith(calls)[0]?.payload).toMatchObject({
      company: { name: "Atlas Interiors", company_type: "designer", rating: 4 },
    });
  });

  it("names the company when its name is taken", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({
      contacts: [none],
      "rpc:save_contact": [
        {
          data: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "companies_name_key"',
          },
        },
      ],
    });

    const result = await saveContact(
      form({
        companyId: "new",
        newCompanyName: "Atlas Interiors",
        newCompanyType: "designer",
      }),
    );

    expect(result.error).toBe(
      "A company with that name already exists. Choose it from the list.",
    );
  });

  it("names the mobile number when it is taken", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({
      contacts: [none],
      "rpc:save_contact": [
        {
          data: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "contacts_mobile_key"',
          },
        },
      ],
    });

    const result = await saveContact(form({}));

    expect(result.error).toBe(
      "Another customer already uses that mobile number.",
    );
  });

  it("asks for a company name when adding a new company", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({});

    const result = await saveContact(
      form({ companyId: "new", newCompanyType: "designer" }),
    );

    expect(result.error).toBe("Enter the company name.");
    expect(calls).toHaveLength(0);
  });

  it("returns the existing contact and owners for a duplicate mobile", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({
      contacts: [
        {
          data: {
            id: CONTACT,
            name: "Lim Wei",
            companies: { name: "Atlas Interiors" },
            contact_owners: [{ profile_id: ARUN }],
          },
          error: null,
        },
      ],
    });

    const result = await saveContact(form({}));

    expect(result).toEqual({
      error: null,
      duplicate: {
        contactId: CONTACT,
        name: "Lim Wei",
        companyName: "Atlas Interiors",
        ownerNames: ["Arun"],
        ownedByMe: false,
      },
    });
    expect(savedWith(calls)).toHaveLength(0);
  });

  it("rejects an edit by someone who is neither owner nor manager", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({
      contacts: [
        {
          data: {
            account_type: "own",
            passed_by: null,
            contact_owners: [{ profile_id: ARUN }],
          },
          error: null,
        },
      ],
    });

    const result = await saveContact(form({ contactId: CONTACT }));

    expect(result.error).toBe(
      "Only the owners, the MD or the Sales Director can change this customer.",
    );
    expect(savedWith(calls)).toHaveLength(0);
  });

  it("lets an owner edit and leaves their account type untouched", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({
      contacts: [
        {
          data: {
            account_type: "company",
            passed_by: null,
            contact_owners: [{ profile_id: ME }],
          },
          error: null,
        },
        none,
      ],
    });

    const result = await saveContact(
      form({ contactId: CONTACT, accountType: "own" }),
    );

    expect(result.error).toBeNull();
    expect(savedWith(calls)[0]?.payload).toMatchObject({
      contact_id: CONTACT,
      contact: { account_type: "company" },
    });
  });

  it("lets the MD edit a customer they do not own", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({
      contacts: [
        {
          data: {
            account_type: "own",
            passed_by: null,
            contact_owners: [{ profile_id: ARUN }],
          },
          error: null,
        },
        none,
      ],
    });

    const result = await saveContact(form({ contactId: CONTACT }));

    expect(result.error).toBeNull();
  });

  it("rejects HR & Accounts, who only read", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase({});

    const result = await saveContact(form({}));

    expect(result.error).toBe(
      "Your role can view customers but not change them.",
    );
    expect(calls).toHaveLength(0);
  });

  it("sends people who may not open Customers away", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    await expect(saveContact(form({}))).rejects.toThrow(
      "redirect:/not-allowed",
    );
  });
});

describe("saveCompany", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("saves the company for the MD", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase({
      companies: [{ data: { id: COMPANY }, error: null }],
    });

    const result = await saveCompany(
      companyForm({ accountType: "pass_down", passedBy: ARUN }),
    );

    expect(result.error).toBeNull();
    expect(calls[0]?.payload).toMatchObject({
      name: "Atlas Interiors",
      company_type: "designer",
      rating: 4,
      account_type: "pass_down",
      passed_by: ARUN,
    });
  });

  it("refuses anyone but the MD or Sales Director", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({});

    const result = await saveCompany(companyForm({}));

    expect(result.error).toBe(
      "Only the MD or the Sales Director can change a company.",
    );
    expect(calls).toHaveLength(0);
  });

  it("names the problem when the name is taken", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({
      companies: [{ data: null, error: { code: "23505", message: "dup" } }],
    });

    const result = await saveCompany(companyForm({}));

    expect(result.error).toBe("A company with that name already exists.");
  });
});
