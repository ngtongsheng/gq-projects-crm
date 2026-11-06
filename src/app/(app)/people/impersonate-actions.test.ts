import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import {
  IMPERSONATION_COOKIE,
  signImpersonation,
  verifyImpersonation,
} from "@/lib/auth/impersonation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { backToMyAccount, signInAs } from "./impersonate-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/admin")>()),
  createAdminClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const cookieStore = new Map<string, string>();
const setCookie = vi.fn((name: string, value: string) => {
  cookieStore.set(name, value);
});
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
    set: setCookie,
    delete: (name: string) => cookieStore.delete(name),
  })),
}));

const SECRET = "service-secret";
const MD_ID = "11111111-1111-4111-8111-111111111111";
const DANIEL_ID = "22222222-2222-4222-8222-222222222222";
const LOG_ID = "33333333-3333-4333-8333-333333333333";

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  id: MD_ID,
  fullName: "Vicky",
  role: "admin",
  jobRole: "md",
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
  ...overrides,
});

function fakeAdmin() {
  const insertedRows: unknown[] = [];
  const deletedIds: unknown[] = [];
  const endedWith: unknown[] = [];
  const emails: Record<string, string> = {
    [DANIEL_ID]: "daniel@example.com",
    [MD_ID]: "vicky@example.com",
  };
  const generateLink = vi.fn(async ({ email }: { email: string }) => ({
    data: { properties: { hashed_token: `hash-for-${email}` } },
    error: null,
  }));
  const admin = {
    auth: {
      admin: {
        generateLink,
        getUserById: vi.fn(async (id: string) => ({
          data: { user: emails[id] ? { email: emails[id] } : null },
          error: null,
        })),
      },
    },
    from: vi.fn(() => ({
      insert: vi.fn((row: unknown) => {
        insertedRows.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: LOG_ID }, error: null }),
          }),
        };
      }),
      delete: vi.fn(() => ({
        eq: vi.fn(async (_column: string, id: unknown) => {
          deletedIds.push(id);
          return { error: null };
        }),
      })),
      update: vi.fn((row: unknown) => ({
        eq: vi.fn(async () => {
          endedWith.push(row);
          return { error: null };
        }),
      })),
    })),
  };
  vi.mocked(createAdminClient).mockReturnValue(
    admin as unknown as ReturnType<typeof createAdminClient>,
  );
  return { generateLink, insertedRows, deletedIds, endedWith };
}

function fakeSession(sub: string | null, verifyError: unknown = null) {
  const verifyOtp = vi.fn(async () => ({ error: verifyError }));
  const signOut = vi.fn(async () => ({ error: null }));
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getClaims: vi.fn(async () => ({
        data: sub ? { claims: { sub } } : null,
      })),
      verifyOtp,
      signOut,
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { verifyOtp, signOut };
}

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  vi.mocked(createAdminClient).mockReset();
  setCookie.mockClear();
  cookieStore.clear();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("signInAs", () => {
  it("is for the MD only: another admin is sent away before anything is touched", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(
      profile({ jobRole: "director" }),
    );
    const { generateLink } = fakeAdmin();

    await expect(signInAs(DANIEL_ID)).rejects.toThrow("redirect:/");
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("is for admins only", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile({ role: "staff" }));
    const { generateLink } = fakeAdmin();

    await expect(signInAs(DANIEL_ID)).rejects.toThrow("redirect:/");
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("refuses signing in as yourself", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile());
    const { generateLink } = fakeAdmin();

    const result = await signInAs(MD_ID);

    expect(result.error).toMatch(/already signed in as yourself/);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("says plainly when the service key is missing", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile());
    vi.mocked(createAdminClient).mockReturnValue(null);

    const result = await signInAs(DANIEL_ID);

    expect(result.error).toMatch(/preview link or the live site/);
  });

  it("records the switch, signs in as the person and remembers the MD", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile());
    const { insertedRows, generateLink } = fakeAdmin();
    const { verifyOtp } = fakeSession(MD_ID);

    await expect(signInAs(DANIEL_ID)).rejects.toThrow("redirect:/");

    expect(insertedRows).toEqual([{ admin_id: MD_ID, target_id: DANIEL_ID }]);
    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "daniel@example.com",
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-for-daniel@example.com",
      type: "magiclink",
    });
    const value = cookieStore.get(IMPERSONATION_COOKIE);
    expect(verifyImpersonation(value, SECRET)).toEqual({
      adminId: MD_ID,
      targetId: DANIEL_ID,
      logId: LOG_ID,
    });
  });

  it("leaves no trace and no cookie when the switch fails", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile());
    const { deletedIds } = fakeAdmin();
    fakeSession(MD_ID, { message: "expired" });

    const result = await signInAs(DANIEL_ID);

    expect(result.error).toMatch(/Could not switch/);
    expect(deletedIds).toEqual([LOG_ID]);
    expect(setCookie).not.toHaveBeenCalled();
  });
});

describe("backToMyAccount", () => {
  const cookieFor = (targetId: string) =>
    signImpersonation({ adminId: MD_ID, targetId, logId: LOG_ID }, SECRET);

  it("does nothing special without a valid cookie", async () => {
    fakeAdmin();
    fakeSession(DANIEL_ID);
    cookieStore.set(IMPERSONATION_COOKIE, "forged.value");

    await expect(backToMyAccount()).rejects.toThrow("redirect:/");
    expect(cookieStore.has(IMPERSONATION_COOKIE)).toBe(false);
  });

  it("only works for the person the cookie names", async () => {
    const { generateLink } = fakeAdmin();
    const { verifyOtp } = fakeSession("44444444-4444-4444-8444-444444444444");
    cookieStore.set(IMPERSONATION_COOKIE, cookieFor(DANIEL_ID));

    await expect(backToMyAccount()).rejects.toThrow("redirect:/");

    expect(generateLink).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(cookieStore.has(IMPERSONATION_COOKIE)).toBe(false);
  });

  it("signs the MD back in, closes the record and clears the cookie", async () => {
    const { generateLink, endedWith } = fakeAdmin();
    const { verifyOtp } = fakeSession(DANIEL_ID);
    cookieStore.set(IMPERSONATION_COOKIE, cookieFor(DANIEL_ID));

    await expect(backToMyAccount()).rejects.toThrow("redirect:/people");

    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "vicky@example.com",
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-for-vicky@example.com",
      type: "magiclink",
    });
    expect(endedWith).toHaveLength(1);
    expect(cookieStore.has(IMPERSONATION_COOKIE)).toBe(false);
  });

  it("signs out rather than stay as the other person when switching back fails", async () => {
    fakeAdmin();
    const { signOut } = fakeSession(DANIEL_ID, { message: "expired" });
    cookieStore.set(IMPERSONATION_COOKIE, cookieFor(DANIEL_ID));

    await expect(backToMyAccount()).rejects.toThrow("redirect:/sign-in");

    expect(signOut).toHaveBeenCalled();
    expect(cookieStore.has(IMPERSONATION_COOKIE)).toBe(false);
  });
});
