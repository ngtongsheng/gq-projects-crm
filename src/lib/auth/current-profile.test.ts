import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "./current-profile";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const ID = "11111111-1111-4111-8111-111111111111";

function signedInWith(row: Record<string, unknown>) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getClaims: async () => ({ data: { claims: { sub: ID } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: row, error: null }) }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

const row = {
  id: ID,
  full_name: "Mei Tan",
  role: "staff",
  job_role: "ssup",
  arranges_stock: true,
  sells: false,
  sees_margin: false,
  commission_mode: "standard",
  yearly_target: null,
  language: "bm",
  active: true,
};

describe("getCurrentProfile", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("returns someone still working here", async () => {
    signedInWith(row);
    await expect(getCurrentProfile()).resolves.toMatchObject({
      id: ID,
      jobRole: "ssup",
      arrangesStock: true,
      sells: false,
      seesMargin: false,
      language: "bm",
    });
  });

  it("sends someone who has left to be signed out", async () => {
    signedInWith({ ...row, active: false });
    await expect(getCurrentProfile()).rejects.toThrow("redirect:/left");
  });
});
