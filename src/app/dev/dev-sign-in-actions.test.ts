import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";
import {
  ADMIN_UNAVAILABLE_MESSAGE,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEV_PROJECT_REF, PROD_PROJECT_REF } from "@/lib/supabase/test-copy";
import { devSignIn } from "./dev-sign-in-actions";

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

const deletedCookies: string[] = [];
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: (name: string) => deletedCookies.push(name),
  })),
}));

function fakeAdmin(emails: string[]) {
  const generateLink = vi.fn(async ({ email }: { email: string }) => ({
    data: { properties: { hashed_token: `hash-for-${email}` } },
    error: null,
  }));
  const admin = {
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users: emails.map((email) => ({ email })) },
          error: null,
        })),
        generateLink,
      },
    },
  };
  vi.mocked(createAdminClient).mockReturnValue(
    admin as unknown as ReturnType<typeof createAdminClient>,
  );
  return { generateLink };
}

function fakeSession() {
  const verifyOtp = vi.fn(async () => ({ error: null }));
  vi.mocked(createClient).mockResolvedValue({
    auth: { verifyOtp },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { verifyOtp };
}

beforeEach(() => {
  vi.clearAllMocks();
  deletedCookies.length = 0;
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    `https://${DEV_PROJECT_REF}.supabase.co`,
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("devSignIn", () => {
  it("signs in as the role's test person and drops any Sign in as", async () => {
    const { generateLink } = fakeAdmin(["test-sales@example.invalid"]);
    const { verifyOtp } = fakeSession();

    await expect(devSignIn("sales")).rejects.toThrow("redirect:/");
    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "test-sales@example.invalid",
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-for-test-sales@example.invalid",
      type: "magiclink",
    });
    expect(deletedCookies).toEqual([IMPERSONATION_COOKIE]);
  });

  it("makes no admin call in a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const result = await devSignIn("md");
    expect(result.error).toMatch(/test copy/);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("makes no admin call against the live app", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      `https://${PROD_PROJECT_REF}.supabase.co`,
    );
    const result = await devSignIn("md");
    expect(result.error).toMatch(/test copy/);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an unknown job role", async () => {
    const result = await devSignIn("ceo");
    expect(result.error).toMatch(/job role/);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("shows the plain message without the server secret", async () => {
    vi.mocked(createAdminClient).mockReturnValue(null);
    expect(await devSignIn("md")).toEqual({
      error: ADMIN_UNAVAILABLE_MESSAGE,
    });
  });

  it("says the test sign-ins need setting up when the person is missing", async () => {
    const { generateLink } = fakeAdmin([]);
    const result = await devSignIn("site");
    expect(result.error).toMatch(/setting up/);
    expect(generateLink).not.toHaveBeenCalled();
  });
});
