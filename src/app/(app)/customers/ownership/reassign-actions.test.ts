import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { reassignCustomer } from "./reassign-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const CONTACT = "11111111-1111-4111-8111-111111111111";
const ARUN = "22222222-2222-4222-8222-222222222222";
const MEI = "33333333-3333-4333-8333-333333333333";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "44444444-4444-4444-8444-444444444444",
  fullName: "Tester",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

function fakeRpc(
  result: {
    data?: unknown;
    error?: { code: string; message: string } | null;
  } = {
    data: 3,
    error: null,
  },
) {
  const rpc = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }));
  vi.mocked(createClient).mockResolvedValue({
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return rpc;
}

const input = {
  contactId: CONTACT,
  ownerIds: [ARUN],
  wholeCompany: true,
  reason: "  Salesperson resigned  ",
};

describe("reassignCustomer", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("hands the company to the new owner and says how many customers moved", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const rpc = fakeRpc();

    const result = await reassignCustomer(input);

    expect(result).toEqual({ error: null, moved: 3 });
    expect(rpc).toHaveBeenCalledWith("reassign_customers", {
      contact: CONTACT,
      new_owners: [ARUN],
      whole_company: true,
      reason: "Salesperson resigned",
    });
  });

  it("lets the Sales Director do it and accepts two owners", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    const rpc = fakeRpc({ data: 1 });

    const result = await reassignCustomer({
      ...input,
      ownerIds: [ARUN, MEI],
      wholeCompany: false,
    });

    expect(result).toEqual({ error: null, moved: 1 });
    expect(rpc).toHaveBeenCalledWith(
      "reassign_customers",
      expect.objectContaining({
        new_owners: [ARUN, MEI],
        whole_company: false,
      }),
    );
  });

  it.each([
    "sales",
    "bd",
    "accounts",
    "support",
  ] as const)("refuses %s before asking the database", async (jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    const rpc = fakeRpc();

    const result = await reassignCustomer(input);

    expect(result.error).toMatch(/Only the MD or the Sales Director/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ ownerIds: [] }, "Choose the new owner."],
    [{ ownerIds: [ARUN, ARUN] }, "Choose two different people, or only one."],
    [
      { ownerIds: [ARUN, MEI, CONTACT] },
      "A customer can have at most two owners.",
    ],
    [{ reason: "   " }, "Add the reason for the change."],
    [{ contactId: "nope" }, "Could not find that customer. Reload the page."],
  ])("refuses %j", async (change, message) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const rpc = fakeRpc();

    const result = await reassignCustomer({ ...input, ...change });

    expect(result.error).toBe(message);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains a refusal from the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeRpc({ error: { code: "42501", message: "no" } });

    const result = await reassignCustomer(input);

    expect(result.error).toMatch(/Only the MD or the Sales Director/);
  });

  it("explains a customer that is gone", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeRpc({ error: { code: "P0002", message: "Customer not found." } });

    const result = await reassignCustomer(input);

    expect(result.error).toBe(
      "That customer no longer exists. Reload the page.",
    );
  });
});
