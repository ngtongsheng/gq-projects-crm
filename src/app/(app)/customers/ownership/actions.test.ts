import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { decideOwnershipRequest, requestOwnership } from "./actions";

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
const CONTACT = "44444444-4444-4444-8444-444444444444";
const REQUEST = "55555555-5555-4555-8555-555555555555";

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
});

type DbError = { code: string; message: string } | null;

function fakeSupabase({ error = null }: { error?: DbError } = {}) {
  const insert = vi.fn(async () => ({ error }));
  const rpc = vi.fn(async () => ({ error }));
  const from = vi.fn(() => ({ insert }));
  vi.mocked(createClient).mockResolvedValue({
    from,
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from, insert, rpc };
}

describe("requestOwnership", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("saves the request for a salesperson", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const db = fakeSupabase();

    const result = await requestOwnership(CONTACT, "  I met her first  ");

    expect(result).toEqual({ error: null });
    expect(db.from).toHaveBeenCalledWith("ownership_requests");
    expect(db.insert).toHaveBeenCalledWith({
      contact_id: CONTACT,
      reason: "I met her first",
    });
  });

  it("asks for a reason", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const db = fakeSupabase();

    const result = await requestOwnership(CONTACT, "   ");

    expect(result.error).toBe("Add a reason so the director can decide.");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects a second open request for the same customer", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({ error: { code: "23505", message: "duplicate" } });

    const result = await requestOwnership(CONTACT, "Still mine");

    expect(result.error).toBe(
      "You already have a request open for this customer.",
    );
  });

  it("keeps managers and read-only roles from asking", async () => {
    for (const jobRole of ["md", "director", "accounts"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
      const db = fakeSupabase();

      const result = await requestOwnership(CONTACT, "Please");

      expect(result.error).toBe(
        "Your role cannot ask for ownership of a customer.",
      );
      expect(db.insert).not.toHaveBeenCalled();
    }
  });
});

describe("decideOwnershipRequest", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("lets the MD and Sales Director approve through the database function", async () => {
    for (const jobRole of ["md", "director"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
      const db = fakeSupabase();

      const result = await decideOwnershipRequest(REQUEST, true);

      expect(result).toEqual({ error: null });
      expect(db.rpc).toHaveBeenCalledWith("decide_ownership_request", {
        request: REQUEST,
        approve: true,
      });
    }
  });

  it("sends a rejection the same way", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    const db = fakeSupabase();

    await decideOwnershipRequest(REQUEST, false);

    expect(db.rpc).toHaveBeenCalledWith("decide_ownership_request", {
      request: REQUEST,
      approve: false,
    });
  });

  it("refuses everyone else before touching the database", async () => {
    for (const jobRole of ["sales", "bd", "accounts"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
      const db = fakeSupabase();

      const result = await decideOwnershipRequest(REQUEST, true);

      expect(result.error).toBe(
        "Only the MD or the Sales Director can decide requests.",
      );
      expect(db.rpc).not.toHaveBeenCalled();
    }
  });

  it("explains when the request was already decided", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ error: { code: "P0002", message: "decided" } });

    const result = await decideOwnershipRequest(REQUEST, true);

    expect(result.error).toBe(
      "Someone already decided this request. Reload the page.",
    );
  });

  it("sends people who may not open Customers away", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    await expect(decideOwnershipRequest(REQUEST, true)).rejects.toThrow(
      "redirect:/not-allowed",
    );
  });
});
