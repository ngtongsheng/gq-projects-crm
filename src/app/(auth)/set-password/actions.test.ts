import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "./actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

function fakeAuth(overrides: {
  verifyOtp?: { error: unknown };
  updateUser?: { error: unknown };
  user?: { id: string } | null;
}) {
  const auth = {
    verifyOtp: vi
      .fn()
      .mockResolvedValue(overrides.verifyOtp ?? { error: null }),
    updateUser: vi
      .fn()
      .mockResolvedValue(overrides.updateUser ?? { error: null }),
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: overrides.user ?? null } }),
  };
  vi.mocked(createClient).mockResolvedValue({
    auth,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return auth;
}

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  data.set("token_hash", "hash");
  data.set("type", "invite");
  data.set("password", "long-enough-1");
  data.set("confirmPassword", "long-enough-1");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setPassword", () => {
  it("rejects passwords that don't match before touching the link", async () => {
    const auth = fakeAuth({});
    const result = await setPassword(form({ confirmPassword: "other-pass-1" }));
    expect(result.error).toBe("The two passwords don't match.");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("spends the link, saves the password and sends the person home", async () => {
    const auth = fakeAuth({});
    await expect(setPassword(form())).rejects.toThrow("redirect:/");
    expect(auth.verifyOtp).toHaveBeenCalledOnce();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "long-enough-1" });
  });

  it("says the link is used when it cannot be verified", async () => {
    const auth = fakeAuth({ verifyOtp: { error: { status: 403 } } });
    const result = await setPassword(form());
    expect(result.error).toMatch(/already been used or has expired/);
    expect(result.linkVerified).toBe(false);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("retries a failed save without spending the link again", async () => {
    const auth = fakeAuth({ updateUser: { error: { status: 422 } } });
    const first = await setPassword(form());
    expect(first.linkVerified).toBe(true);
    expect(first.error).toMatch(/Try again/);

    auth.updateUser.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await expect(
      setPassword(form({ link_verified: String(first.linkVerified) })),
    ).rejects.toThrow("redirect:/");

    expect(auth.verifyOtp).toHaveBeenCalledOnce();
    expect(auth.updateUser).toHaveBeenCalledTimes(2);
  });

  it("verifies the link when someone is signed in but the form has not verified it", async () => {
    const auth = fakeAuth({ user: { id: "admin" } });
    await expect(setPassword(form())).rejects.toThrow("redirect:/");
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.verifyOtp).toHaveBeenCalledOnce();
  });
});
