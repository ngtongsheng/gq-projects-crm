import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addPerson, changeRole } from "./actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/admin")>()),
  createAdminClient: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "crm.example.com" })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const profile = (role: Profile["role"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Tester",
  role,
});

const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function personForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

const validForm = {
  fullName: "Mei Tan",
  email: "Mei@Example.com ",
  role: "staff",
};
const empty = { error: null, invite: null };

function fakeAdminClient(generateLinkResult: unknown) {
  const profileUpdate = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  const generateLink = vi.fn(async () => generateLinkResult);
  const client = {
    auth: { admin: { generateLink } },
    from: vi.fn(() => ({ update: profileUpdate })),
  };
  vi.mocked(createAdminClient).mockReturnValue(
    client as unknown as ReturnType<typeof createAdminClient>,
  );
  return { generateLink, profileUpdate };
}

const linkOk = {
  data: {
    properties: { hashed_token: "abc123", verification_type: "invite" },
    user: { id: OTHER_ID },
  },
  error: null,
};

describe("addPerson", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(createAdminClient).mockReset();
  });

  it("rejects staff", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff"));
    await expect(addPerson(empty, personForm(validForm))).rejects.toThrow(
      "redirect:/",
    );
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a signed-out caller", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null);
    await expect(addPerson(empty, personForm(validForm))).rejects.toThrow(
      "redirect:/sign-in",
    );
  });

  it("rejects an invalid email without touching Supabase", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const result = await addPerson(
      empty,
      personForm({ ...validForm, email: "not-an-email" }),
    );
    expect(result.error).toBe("Enter a valid email address.");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an unknown role and a blank name", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const badRole = await addPerson(
      empty,
      personForm({ ...validForm, role: "owner" }),
    );
    expect(badRole.invite).toBeNull();
    expect(badRole.error).not.toBeNull();

    const noName = await addPerson(
      empty,
      personForm({ ...validForm, fullName: "  " }),
    );
    expect(noName.error).toBe("Enter their name.");
  });

  it("shows a plain message when the service key is missing", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    vi.mocked(createAdminClient).mockReturnValue(null);
    const result = await addPerson(empty, personForm(validForm));
    expect(result).toEqual({
      error: "Adding people works on the preview link or the live site.",
      invite: null,
    });
  });

  it("creates a set-password link and keeps new people as staff", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { generateLink, profileUpdate } = fakeAdminClient(linkOk);

    const result = await addPerson(empty, personForm(validForm));

    expect(generateLink).toHaveBeenCalledWith({
      type: "invite",
      email: "mei@example.com",
      options: { data: { full_name: "Mei Tan" } },
    });
    expect(result.error).toBeNull();
    expect(result.invite?.link).toBe(
      "https://crm.example.com/set-password?token_hash=abc123&type=invite",
    );
    expect(result.invite?.message).toContain(result.invite?.link);
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("promotes to admin when asked", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { profileUpdate } = fakeAdminClient(linkOk);

    const result = await addPerson(
      empty,
      personForm({ ...validForm, role: "admin" }),
    );

    expect(profileUpdate).toHaveBeenCalledWith({ role: "admin" });
    expect(result.error).toBeNull();
  });

  it("explains a duplicate email in plain words", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeAdminClient({ data: null, error: { code: "email_exists" } });
    const result = await addPerson(empty, personForm(validForm));
    expect(result).toEqual({
      error: "Someone with that email is already added.",
      invite: null,
    });
  });
});

function fakeUserClient(admins: { id: string }[], updatedRows = 1) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(async () => ({
        data: Array.from({ length: updatedRows }, () => ({ id: OTHER_ID })),
        error: null,
      })),
    })),
  }));
  const select = vi.fn(() => ({
    eq: vi.fn(async () => ({ data: admins, error: null })),
  }));
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => ({ select, update })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { update };
}

describe("changeRole", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(createClient).mockReset();
  });

  it("rejects staff", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff"));
    await expect(
      changeRole({ userId: OTHER_ID, role: "admin" }),
    ).rejects.toThrow("redirect:/");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects malformed input", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    expect(await changeRole({ userId: "nope", role: "admin" })).toEqual({
      error: "Choose a role.",
    });
    expect(await changeRole({ userId: OTHER_ID, role: "owner" })).toEqual({
      error: "Choose a role.",
    });
  });

  it("blocks demoting the last admin", async () => {
    const me = profile("admin");
    vi.mocked(getCurrentProfile).mockResolvedValue(me);
    const { update } = fakeUserClient([{ id: me.id }]);

    const result = await changeRole({ userId: me.id, role: "staff" });

    expect(result).toEqual({ error: "There must be at least one admin." });
    expect(update).not.toHaveBeenCalled();
  });

  it("allows demoting an admin when another admin remains", async () => {
    const me = profile("admin");
    vi.mocked(getCurrentProfile).mockResolvedValue(me);
    const { update } = fakeUserClient([{ id: me.id }, { id: OTHER_ID }]);

    const result = await changeRole({ userId: me.id, role: "staff" });

    expect(result).toEqual({ error: null });
    expect(update).toHaveBeenCalledWith({ role: "staff" });
  });

  it("allows promoting staff to admin", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { update } = fakeUserClient([]);
    expect(await changeRole({ userId: OTHER_ID, role: "admin" })).toEqual({
      error: null,
    });
    expect(update).toHaveBeenCalledWith({ role: "admin" });
  });

  it("reports when nothing was updated", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeUserClient([], 0);
    const result = await changeRole({ userId: OTHER_ID, role: "admin" });
    expect(result.error).toBe("Could not change the role. Try again.");
  });
});
