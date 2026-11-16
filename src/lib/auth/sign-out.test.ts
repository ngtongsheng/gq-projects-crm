import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { IMPERSONATION_COOKIE, signImpersonation } from "./impersonation";
import { signOut } from "./sign-out";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
    delete: (name: string) => cookieStore.delete(name),
  })),
}));

const SECRET = "service-secret";
const LOG_ID = "33333333-3333-4333-8333-333333333333";

function fakeClients() {
  const ended: unknown[] = [];
  const endedIds: unknown[] = [];
  const cookieGoneAtWrite: boolean[] = [];
  const admin = {
    from: vi.fn((table: string) => ({
      update: vi.fn((row: unknown) => ({
        eq: vi.fn(async (_column: string, id: unknown) => {
          if (table === "impersonation_log") {
            ended.push(row);
            endedIds.push(id);
            cookieGoneAtWrite.push(!cookieStore.has(IMPERSONATION_COOKIE));
          }
          return { error: null };
        }),
      })),
    })),
  };
  vi.mocked(createAdminClient).mockReturnValue(
    admin as unknown as ReturnType<typeof createAdminClient>,
  );
  const authSignOut = vi.fn(async () => ({ error: null }));
  vi.mocked(createClient).mockResolvedValue({
    auth: { signOut: authSignOut },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { ended, endedIds, cookieGoneAtWrite, authSignOut };
}

beforeEach(() => {
  vi.mocked(createAdminClient).mockReset();
  cookieStore.clear();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET);
});

describe("signOut", () => {
  it("ends the open view as record and clears the cookie when signing out while viewing as someone", async () => {
    const { ended, endedIds, cookieGoneAtWrite, authSignOut } = fakeClients();
    cookieStore.set(
      IMPERSONATION_COOKIE,
      signImpersonation(
        {
          adminId: "11111111-1111-4111-8111-111111111111",
          adminName: "Vicky",
          targetId: "22222222-2222-4222-8222-222222222222",
          logId: LOG_ID,
        },
        SECRET,
      ),
    );

    await expect(signOut()).rejects.toThrow("redirect:/sign-in");

    expect(ended).toHaveLength(1);
    expect(ended[0]).toEqual({ ended_at: expect.any(String) });
    expect(endedIds).toEqual([LOG_ID]);
    // The write only passes the View as guard once the cookie is gone.
    expect(cookieGoneAtWrite).toEqual([true]);
    expect(cookieStore.has(IMPERSONATION_COOKIE)).toBe(false);
    expect(authSignOut).toHaveBeenCalled();
  });

  it("just signs out when nobody is viewing as someone", async () => {
    const { ended, authSignOut } = fakeClients();

    await expect(signOut()).rejects.toThrow("redirect:/sign-in");

    expect(ended).toHaveLength(0);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(authSignOut).toHaveBeenCalled();
  });
});
