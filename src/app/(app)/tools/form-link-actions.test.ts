import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { addFormLink, removeFormLink } from "./form-link-actions";

vi.mock("@/lib/auth/require-page", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const signedInAs = (role: Profile["role"]) =>
  vi.mocked(requirePage).mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Someone",
    role,
    jobRole: "sales",
    arrangesStock: false,
    sells: false,
    seesMargin: false,
    commissionMode: "standard",
    yearlyTarget: null,
    language: "en",
  });

function fakeSupabase(
  error: { code?: string; message?: string } | null = null,
) {
  const insert = vi.fn(() => Promise.resolve({ error }));
  const remove = vi.fn(() => ({ eq: () => Promise.resolve({ error }) }));
  vi.mocked(createClient).mockResolvedValue({
    from: () => ({ insert, delete: remove }),
  } as never);
  return { insert, remove };
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const VALID = {
  name: "Site inspection checklist",
  url: "https://drive.google.com/file/d/abc",
  note: "",
};

beforeEach(() => vi.clearAllMocks());

describe("addFormLink", () => {
  it("saves a link for an admin, a blank note as empty", async () => {
    signedInAs("admin");
    const { insert } = fakeSupabase();
    expect(await addFormLink(form(VALID))).toEqual({ error: null });
    expect(insert).toHaveBeenCalledWith(VALID);
  });

  it("refuses staff before touching the database", async () => {
    signedInAs("staff");
    const { insert } = fakeSupabase();
    const result = await addFormLink(form(VALID));
    expect(result.error).toMatch(/admin/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a link that is not https", async () => {
    signedInAs("admin");
    const { insert } = fakeSupabase();
    const result = await addFormLink(form({ ...VALID, url: "http://x.com" }));
    expect(result.error).toBe("Key in the full https:// link.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a missing name", async () => {
    signedInAs("admin");
    fakeSupabase();
    const result = await addFormLink(form({ ...VALID, name: "  " }));
    expect(result.error).toBe("Key in the form name.");
  });

  it("says so when the database refuses the person", async () => {
    signedInAs("admin");
    fakeSupabase({ code: "42501" });
    expect((await addFormLink(form(VALID))).error).toMatch(/admin/);
  });
});

describe("removeFormLink", () => {
  it("removes for an admin and refuses staff", async () => {
    const { remove } = fakeSupabase();
    signedInAs("admin");
    expect(
      await removeFormLink("11111111-1111-4111-8111-111111111111"),
    ).toEqual({ error: null });
    expect(remove).toHaveBeenCalledTimes(1);

    signedInAs("staff");
    expect(
      (await removeFormLink("11111111-1111-4111-8111-111111111111")).error,
    ).toMatch(/admin/);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
