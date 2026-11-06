import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  addPerson,
  changeRole,
  newSignInLink,
  updatePersonSettings,
} from "./actions";

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
  jobRole: "sales",
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
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
    await expect(addPerson(personForm(validForm))).rejects.toThrow(
      "redirect:/",
    );
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a signed-out caller", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null);
    await expect(addPerson(personForm(validForm))).rejects.toThrow(
      "redirect:/sign-in",
    );
  });

  it("rejects an invalid email without touching Supabase", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const result = await addPerson(
      personForm({ ...validForm, email: "not-an-email" }),
    );
    expect(result.error).toBe("Enter a valid email address.");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an unknown role and a blank name", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const badRole = await addPerson(
      personForm({ ...validForm, role: "owner" }),
    );
    expect(badRole.invite).toBeNull();
    expect(badRole.error).not.toBeNull();

    const noName = await addPerson(
      personForm({ ...validForm, fullName: "  " }),
    );
    expect(noName.error).toBe("Enter their name.");
  });

  it("shows a plain message when the service key is missing", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    vi.mocked(createAdminClient).mockReturnValue(null);
    const result = await addPerson(personForm(validForm));
    expect(result).toEqual({
      error: "Adding people works on the preview link or the live site.",
      invite: null,
    });
  });

  it("creates a set-password link and keeps new people as staff", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { generateLink, profileUpdate } = fakeAdminClient(linkOk);

    const result = await addPerson(personForm(validForm));

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

    const result = await addPerson(personForm({ ...validForm, role: "admin" }));

    expect(profileUpdate).toHaveBeenCalledWith({
      role: "admin",
      job_role: "sales",
    });
    expect(result.error).toBeNull();
  });

  it("sets the job role chosen in the form", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { profileUpdate } = fakeAdminClient(linkOk);

    const result = await addPerson(
      personForm({ ...validForm, jobRole: "support" }),
    );

    expect(profileUpdate).toHaveBeenCalledWith({ job_role: "support" });
    expect(result.error).toBeNull();
  });

  it("opens WhatsApp with the message when a mobile number is given", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeAdminClient(linkOk);

    const result = await addPerson(
      personForm({ ...validForm, mobile: "012-345 6789" }),
    );

    expect(result.invite?.whatsappUrl).toBe(
      `https://wa.me/60123456789?text=${encodeURIComponent(result.invite?.message ?? "")}`,
    );
  });

  it("has no WhatsApp shortcut without a mobile number", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeAdminClient(linkOk);

    const result = await addPerson(personForm(validForm));

    expect(result.invite?.whatsappUrl).toBeNull();
  });

  it("refuses a mobile number that is not a full Malaysian number", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { generateLink } = fakeAdminClient(linkOk);

    const result = await addPerson(
      personForm({ ...validForm, mobile: "12345" }),
    );

    expect(result.error).toMatch(/Malaysian mobile number/);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("explains a duplicate email in plain words", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeAdminClient({ data: null, error: { code: "email_exists" } });
    const result = await addPerson(personForm(validForm));
    expect(result).toEqual({
      error: "Someone with that email is already added.",
      invite: null,
    });
  });
});

describe("newSignInLink", () => {
  function fakeAdminWithUser(user: unknown, linkResult: unknown) {
    const generateLink = vi.fn(async () => linkResult);
    const getUserById = vi.fn(async () => user);
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { generateLink, getUserById } },
    } as unknown as ReturnType<typeof createAdminClient>);
    return { generateLink };
  }

  const found = {
    data: {
      user: {
        email: "mei@example.com",
        user_metadata: { full_name: "Mei Tan" },
      },
    },
    error: null,
  };

  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("makes a fresh recovery link for someone already added", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { generateLink } = fakeAdminWithUser(found, {
      data: {
        properties: { hashed_token: "new123", verification_type: "recovery" },
      },
      error: null,
    });

    const result = await newSignInLink(OTHER_ID);

    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "mei@example.com",
    });
    expect(result.error).toBeNull();
    expect(result.invite?.link).toBe(
      "https://crm.example.com/set-password?token_hash=new123&type=recovery",
    );
    expect(result.invite?.message).toContain("Mei Tan");
    expect(result.invite?.whatsappUrl).toBeNull();
  });

  it("refuses anyone who is not an admin", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff"));
    const { generateLink } = fakeAdminWithUser(found, { data: null });

    await expect(newSignInLink(OTHER_ID)).rejects.toThrow("redirect:/");
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("explains when the person cannot be found", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeAdminWithUser({ data: { user: null }, error: null }, { data: null });

    const result = await newSignInLink(OTHER_ID);

    expect(result.invite).toBeNull();
    expect(result.error).toBe("Could not find that person. Reload the page.");
  });

  it("says plainly when the service key is missing", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    vi.mocked(createAdminClient).mockReturnValue(null);

    const result = await newSignInLink(OTHER_ID);

    expect(result).toEqual({
      error: "Adding people works on the preview link or the live site.",
      invite: null,
    });
  });
});

function fakeUserClient(
  admins: { id: string }[],
  updatedRows = 1,
  updateError: { code: string; message: string } | null = null,
) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(async () => ({
        data: updateError
          ? null
          : Array.from({ length: updatedRows }, () => ({ id: OTHER_ID })),
        error: updateError,
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

  it("explains when the database keeps the last admin", async () => {
    const me = profile("admin");
    vi.mocked(getCurrentProfile).mockResolvedValue(me);
    // The other admin was demoted at the same moment, so the trigger refuses.
    fakeUserClient([{ id: me.id }, { id: OTHER_ID }], 0, {
      code: "23514",
      message: "There must be at least one admin.",
    });

    const result = await changeRole({ userId: me.id, role: "staff" });

    expect(result).toEqual({ error: "There must be at least one admin." });
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

const validSettings = {
  userId: OTHER_ID,
  jobRole: "site",
  arrangesStock: "on",
  commissionMode: "flat_pass_down",
  yearlyTarget: " 250,000.50 ",
};

function fakeSettingsClient(updatedRows = 1) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(async () => ({
        data: Array.from({ length: updatedRows }, () => ({ id: OTHER_ID })),
        error: null,
      })),
    })),
  }));
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => ({ update })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { update };
}

describe("updatePersonSettings", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(createClient).mockReset();
  });

  it("rejects staff", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff"));
    await expect(
      updatePersonSettings(personForm(validSettings)),
    ).rejects.toThrow("redirect:/");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("saves the settings in database columns", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { update } = fakeSettingsClient();

    const result = await updatePersonSettings(personForm(validSettings));

    expect(result).toEqual({ error: null });
    expect(update).toHaveBeenCalledWith({
      job_role: "site",
      arranges_stock: true,
      commission_mode: "flat_pass_down",
      yearly_target: 250000.5,
    });
  });

  it("treats an unchecked box as false and a blank target as none", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { update } = fakeSettingsClient();
    const { arrangesStock: _unchecked, ...rest } = validSettings;

    await updatePersonSettings(personForm({ ...rest, yearlyTarget: "" }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ arranges_stock: false, yearly_target: null }),
    );
  });

  it.each([
    ["an unknown job role", { jobRole: "ceo" }],
    ["an unknown commission setting", { commissionMode: "double" }],
    ["a malformed person id", { userId: "nope" }],
    ["a negative target", { yearlyTarget: "-5" }],
    ["a target with three decimals", { yearlyTarget: "10.555" }],
    ["a target in words", { yearlyTarget: "lots" }],
  ])("rejects %s without touching Supabase", async (_label, change) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const result = await updatePersonSettings(
      personForm({ ...validSettings, ...change }),
    );
    expect(result.error).not.toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("reports when nothing was updated", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeSettingsClient(0);
    const result = await updatePersonSettings(personForm(validSettings));
    expect(result.error).toBe("Could not save their settings. Try again.");
  });
});
