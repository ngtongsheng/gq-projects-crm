import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

function fakeSupabase({
  email = "mei@gqprojects.com.my",
  profile = { active: true } as { active: boolean } | null,
  exchangeError = null as { message: string } | null,
} = {}) {
  const exchangeCodeForSession = vi.fn(async () =>
    exchangeError
      ? { data: { user: null, session: null }, error: exchangeError }
      : { data: { user: { id: USER_ID, email } }, error: null },
  );
  const signOut = vi.fn(async () => ({ error: null }));
  const eq = vi.fn(() => ({
    maybeSingle: async () => ({ data: profile, error: null }),
  }));
  vi.mocked(createClient).mockResolvedValue({
    auth: { exchangeCodeForSession, signOut },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { exchangeCodeForSession, signOut, eq };
}

function callback(query: string) {
  return GET(
    new NextRequest(`https://office.example.com/auth/callback?${query}`),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "gqprojects.com.my");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Google sign-in callback", () => {
  it("signs in an active person on the company domain", async () => {
    const { exchangeCodeForSession, signOut, eq } = fakeSupabase();
    await expect(callback("code=abc")).rejects.toThrow("redirect:/");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(eq).toHaveBeenCalledWith("id", USER_ID);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out a Google account off the company domain", async () => {
    const { signOut } = fakeSupabase({ email: "mei@gmail.com" });
    await expect(callback("code=abc")).rejects.toThrow(
      "redirect:/sign-in?refused=domain",
    );
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("signs out someone with no person in People", async () => {
    const { signOut } = fakeSupabase({ profile: null });
    await expect(callback("code=abc")).rejects.toThrow(
      "redirect:/sign-in?refused=not-added",
    );
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("signs out someone who has left", async () => {
    const { signOut } = fakeSupabase({ profile: { active: false } });
    await expect(callback("code=abc")).rejects.toThrow(
      "redirect:/sign-in?refused=left",
    );
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("refuses everyone when the allowed domains are not set", async () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "");
    const { signOut } = fakeSupabase();
    await expect(callback("code=abc")).rejects.toThrow(
      "redirect:/sign-in?refused=domain",
    );
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("explains a Google account nobody added (Supabase sign-ups are off)", async () => {
    const { exchangeCodeForSession } = fakeSupabase();
    await expect(
      callback(
        "error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed",
      ),
    ).rejects.toThrow("redirect:/sign-in?refused=not-added");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("says to try again when the code cannot be exchanged", async () => {
    fakeSupabase({ exchangeError: { message: "invalid flow state" } });
    await expect(callback("code=stale")).rejects.toThrow(
      "redirect:/sign-in?refused=failed",
    );
    expect(console.error).toHaveBeenCalledOnce();
  });
});
