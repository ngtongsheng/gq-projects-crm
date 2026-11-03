import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "./actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

function signInReturns(error: { status?: number } | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithPassword: vi.fn().mockResolvedValue({ error }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

function form(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("signIn", () => {
  it("asks for both fields", async () => {
    expect(await signIn(form("a@b.my", ""))).toEqual({
      error: "Enter your email and password.",
    });
  });

  it("gives one message for a wrong email or password", async () => {
    signInReturns({ status: 400 });
    expect(await signIn(form("a@b.my", "wrong"))).toEqual({
      error: "That email and password don't match.",
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    0, 429, 503,
  ])("says to try again, and logs, when Supabase fails with status %i", async (status) => {
    signInReturns({ status });
    const result = await signIn(form("a@b.my", "secret"));
    expect(result.error).toMatch(/Try again/);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("sends a signed-in person home", async () => {
    signInReturns(null);
    await expect(signIn(form("a@b.my", "secret"))).rejects.toThrow(
      "redirect:/",
    );
  });
});
