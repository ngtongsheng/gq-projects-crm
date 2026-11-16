import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { todayMyt } from "@/lib/format/date";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addPerson, changeRole, updatePersonSettings } from "./actions";

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
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
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

function fakeAdminClient(createUserResult: unknown) {
  const profileUpdate = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  const createUser = vi.fn(async () => createUserResult);
  const client = {
    auth: { admin: { createUser } },
    from: vi.fn(() => ({ update: profileUpdate })),
  };
  vi.mocked(createAdminClient).mockReturnValue(
    client as unknown as ReturnType<typeof createAdminClient>,
  );
  return { createUser, profileUpdate };
}

const personCreated = { data: { user: { id: OTHER_ID } }, error: null };

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
      error:
        "Adding people works on the live app, or after Claude sets up your laptop.",
      invite: null,
    });
  });

  it("adds a confirmed person, shares the app link and saves them as staff", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { createUser, profileUpdate } = fakeAdminClient(personCreated);

    const result = await addPerson(personForm(validForm));

    // Confirmed, so their first Google sign-in links to this user instead of being refused.
    expect(createUser).toHaveBeenCalledWith({
      email: "mei@example.com",
      email_confirm: true,
      user_metadata: { full_name: "Mei Tan" },
    });
    expect(result.error).toBeNull();
    expect(result.invite?.link).toBe("https://crm.example.com/sign-in");
    expect(result.invite?.message).toContain(result.invite?.link);
    expect(result.invite?.message).toContain(
      "sign in with Google as mei@example.com",
    );
    expect(profileUpdate).toHaveBeenCalledWith({
      role: "staff",
      job_role: "sales",
      title: null,
      joined_on: null,
      reports_to: null,
      whatsapp: null,
      language: "en",
    });
  });

  it("promotes to admin when asked", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { profileUpdate } = fakeAdminClient(personCreated);

    const result = await addPerson(personForm({ ...validForm, role: "admin" }));

    expect(profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin", job_role: "sales" }),
    );
    expect(result.error).toBeNull();
  });

  it("sets the job role chosen in the form", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { profileUpdate } = fakeAdminClient(personCreated);

    const result = await addPerson(
      personForm({ ...validForm, jobRole: "support" }),
    );

    expect(profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ job_role: "support" }),
    );
    expect(result.error).toBeNull();
  });

  it("saves the person fields and the WhatsApp number", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { profileUpdate } = fakeAdminClient(personCreated);

    const result = await addPerson(
      personForm({
        ...validForm,
        mobile: "012-345 6789",
        title: " Purchasing · MOF, PO ",
        joinedOn: "2026-01-05",
        reportsTo: OTHER_ID,
        language: "bm",
      }),
    );

    expect(profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Purchasing · MOF, PO",
        joined_on: "2026-01-05",
        reports_to: OTHER_ID,
        whatsapp: "60123456789",
        language: "bm",
      }),
    );
    expect(result.error).toBeNull();
  });

  it("refuses an unknown language and a malformed join date", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { createUser } = fakeAdminClient(personCreated);

    const changes: Record<string, string>[] = [
      { language: "fr" },
      { joinedOn: "5/1/2026" },
    ];
    for (const change of changes) {
      const result = await addPerson(personForm({ ...validForm, ...change }));
      expect(result.error).not.toBeNull();
    }
    expect(createUser).not.toHaveBeenCalled();
  });

  it("opens WhatsApp with the message when a mobile number is given", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeAdminClient(personCreated);

    const result = await addPerson(
      personForm({ ...validForm, mobile: "012-345 6789" }),
    );

    expect(result.invite?.whatsappUrl).toBe(
      `https://wa.me/60123456789?text=${encodeURIComponent(result.invite?.message ?? "")}`,
    );
  });

  it("has no WhatsApp shortcut without a mobile number", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeAdminClient(personCreated);

    const result = await addPerson(personForm(validForm));

    expect(result.invite?.whatsappUrl).toBeNull();
  });

  it("refuses a mobile number that is not a full Malaysian number", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { createUser } = fakeAdminClient(personCreated);

    const result = await addPerson(
      personForm({ ...validForm, mobile: "12345" }),
    );

    expect(result.error).toMatch(/Malaysian mobile number/);
    expect(createUser).not.toHaveBeenCalled();
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

const LEAD_ID = "33333333-3333-4333-8333-333333333333";

const THIS_YEAR = Number(todayMyt().slice(0, 4));

const validSettings = {
  userId: OTHER_ID,
  jobRole: "site",
  arrangesStock: "on",
  sells: "on",
  commissionMode: "flat_pass_down",
  targetYear: String(THIS_YEAR),
  salesTarget: " 250,000.50 ",
  visitTarget: "40",
  whatsapp: "+60 12-345 6789",
  title: "Site Supervisor · Klang Valley",
  joinedOn: "2025-03-01",
  reportsTo: LEAD_ID,
  language: "bm",
};

function fakeSettingsClient(
  updatedRows = 1,
  error: { code: string; message: string } | null = null,
  targetError: { code: string; message: string } | null = null,
  handoverError: { code: string; message: string } | null = null,
) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(async () => ({
        data: error
          ? null
          : Array.from({ length: updatedRows }, () => ({ id: OTHER_ID })),
        error,
      })),
    })),
  }));
  const upsert = vi.fn(async () => ({ error: targetError }));
  const deleteEq = vi.fn(async () => ({ error: targetError }));
  const remove = vi.fn(() => ({ eq: vi.fn(() => ({ eq: deleteEq })) }));
  const rpc = vi.fn(async () => ({ data: 0, error: handoverError }));
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn((table: string) =>
      table === "yearly_targets" ? { upsert, delete: remove } : { update },
    ),
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { update, upsert, remove, rpc };
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
      sells: true,
      sees_margin: false,
      commission_mode: "flat_pass_down",
      whatsapp: "60123456789",
      title: "Site Supervisor · Klang Valley",
      joined_on: "2025-03-01",
      reports_to: LEAD_ID,
      language: "bm",
      active: true,
      left_on: null,
      left_reason: null,
    });
  });

  it("marks someone as left with the date and reason", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { update } = fakeSettingsClient();

    const result = await updatePersonSettings(
      personForm({
        ...validSettings,
        hasLeft: "on",
        leftOn: "2026-11-10",
        leftReason: " Resigned ",
      }),
    );

    expect(result).toEqual({ error: null });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
        left_on: "2026-11-10",
        left_reason: "Resigned",
      }),
    );
  });

  it("clears the leaving date and reason of someone still here", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { update } = fakeSettingsClient();

    await updatePersonSettings(
      personForm({ ...validSettings, leftOn: "2026-11-10", leftReason: "x" }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        left_on: null,
        left_reason: null,
      }),
    );
  });

  it("hands their work over after marking them as left", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { update, rpc } = fakeSettingsClient();

    const result = await updatePersonSettings(
      personForm({
        ...validSettings,
        hasLeft: "on",
        leftOn: "2026-11-10",
        handOverTo: LEAD_ID,
      }),
    );

    expect(result).toEqual({ error: null });
    expect(rpc).toHaveBeenCalledWith("hand_over_work", {
      leaver: OTHER_ID,
      recipient: LEAD_ID,
    });
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
  });

  it("hands nothing over for someone still here or with no one chosen", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { rpc } = fakeSettingsClient();

    await updatePersonSettings(
      personForm({ ...validSettings, handOverTo: LEAD_ID }),
    );
    await updatePersonSettings(
      personForm({ ...validSettings, hasLeft: "on", leftOn: "2026-11-10" }),
    );

    expect(rpc).not.toHaveBeenCalled();
  });

  it("says so when the handover is refused, after saving the rest", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeSettingsClient(1, null, null, {
      code: "22023",
      message: "Choose someone who still works here.",
    });

    const result = await updatePersonSettings(
      personForm({
        ...validSettings,
        hasLeft: "on",
        leftOn: "2026-11-10",
        handOverTo: LEAD_ID,
      }),
    );

    expect(result.error).toBe(
      "Their other settings were saved. Choose someone else who still works here to receive their work.",
    );
  });

  it("needs the leaving date when someone has left", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const result = await updatePersonSettings(
      personForm({ ...validSettings, hasLeft: "on" }),
    );
    expect(result.error).toBe("Enter the date they left.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses marking yourself as left", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const result = await updatePersonSettings(
      personForm({
        ...validSettings,
        userId: profile("admin").id,
        hasLeft: "on",
        leftOn: "2026-11-10",
      }),
    );
    expect(result.error).toBe("You can't mark yourself as left.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("explains when the database refuses who they report to", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeSettingsClient(0, {
      code: "23514",
      message:
        "A person can only report to a Sales Director or Marketing Director.",
    });
    const result = await updatePersonSettings(personForm(validSettings));
    expect(result.error).toBe(
      "They can only report to a Sales Director or Marketing Director.",
    );
  });

  it("never writes profiles.yearly_target; targets go to the per-year table", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { update, upsert } = fakeSettingsClient();

    await updatePersonSettings(personForm(validSettings));

    expect(update).toHaveBeenCalledWith(
      expect.not.objectContaining({ yearly_target: expect.anything() }),
    );
    expect(upsert).toHaveBeenCalledWith(
      {
        profile_id: OTHER_ID,
        year: THIS_YEAR,
        sales_target: 250000.5,
        visit_target: 40,
      },
      { onConflict: "profile_id,year" },
    );
  });

  it("can set next year's targets", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { upsert } = fakeSettingsClient();

    await updatePersonSettings(
      personForm({ ...validSettings, targetYear: String(THIS_YEAR + 1) }),
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ year: THIS_YEAR + 1 }),
      expect.anything(),
    );
  });

  it("removes the year's row when both targets are blank, so the grade default applies", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { upsert, remove } = fakeSettingsClient();

    const result = await updatePersonSettings(
      personForm({ ...validSettings, salesTarget: "", visitTarget: "" }),
    );

    expect(result).toEqual({ error: null });
    expect(remove).toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("leaves targets alone when the form carries none", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { upsert, remove } = fakeSettingsClient();
    const { targetYear: _year, ...rest } = validSettings;

    const result = await updatePersonSettings(personForm(rest));

    expect(result).toEqual({ error: null });
    expect(upsert).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("says so when the database refuses the targets, after saving the rest", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    fakeSettingsClient(1, null, {
      code: "42501",
      message: "new row violates row-level security policy",
    });
    const result = await updatePersonSettings(personForm(validSettings));
    expect(result.error).toBe(
      "Their other settings were saved. Only the Managing Director, Sales Directors and HR & Accounts can set targets.",
    );
  });

  it("treats an unchecked box as false", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin"));
    const { update } = fakeSettingsClient();
    const { arrangesStock: _unchecked, ...rest } = validSettings;

    await updatePersonSettings(personForm(rest));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ arranges_stock: false }),
    );
  });

  it.each([
    ["an unknown job role", { jobRole: "ceo" }],
    ["an unknown commission setting", { commissionMode: "double" }],
    ["a malformed person id", { userId: "nope" }],
    ["a negative target", { salesTarget: "-5" }],
    ["a target with three decimals", { salesTarget: "10.555" }],
    ["a target in words", { salesTarget: "lots" }],
    ["a part visit", { visitTarget: "2.5" }],
    ["a targets year two years ahead", { targetYear: String(THIS_YEAR + 2) }],
    ["a targets year that is not a year", { targetYear: "soon" }],
    ["an unknown language", { language: "fr" }],
    ["a WhatsApp number that is not Malaysian", { whatsapp: "12345" }],
    ["a malformed reports-to id", { reportsTo: "nope" }],
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
