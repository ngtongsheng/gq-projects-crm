import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSiteStage } from "@/app/(app)/site-work/actions";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";
import { createAdminClient } from "./admin";
import { createClient } from "./server";
import { VIEW_ONLY_CODE, VIEW_ONLY_MESSAGE } from "./view-only-fetch";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieStore.has(name)
        ? { name, value: cookieStore.get(name) }
        : undefined,
    getAll: () => [...cookieStore].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name),
  })),
}));

const BASE = "https://project.supabase.co";
const MOF = "33333333-3333-4333-8333-333333333333";

const siteSupervisor: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Awal",
  role: "staff",
  jobRole: "site",
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
};

const network = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
  Response.json([{ id: MOF, customer: "Daniel's customer" }]),
);
const saves = () =>
  network.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");

beforeEach(() => {
  cookieStore.clear();
  network.mockClear();
  vi.stubGlobal("fetch", network);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  vi.mocked(getCurrentProfile).mockResolvedValue(siteSupervisor);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("while the MD views as someone", () => {
  beforeEach(() => {
    cookieStore.set(IMPERSONATION_COOKIE, "any.value");
  });

  it("a server action fails and nothing reaches the database", async () => {
    const result = await setSiteStage(MOF, "ongoing");

    expect(result.error).not.toBeNull();
    expect(saves()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "Could not change the site stage",
      expect.objectContaining({ code: VIEW_ONLY_CODE }),
    );
  });

  it("refuses inserts, updates, deletes and writing functions with the view-only message", async () => {
    const supabase = await createClient();
    const results = await Promise.all([
      supabase.from("mofs").insert({ id: MOF }),
      supabase.from("mofs").update({ id: MOF }).eq("id", MOF),
      supabase.from("mofs").delete().eq("id", MOF),
      supabase.rpc("set_site_stage", { mof_id: MOF, stage: "ongoing" }),
    ]);

    for (const { error } of results) {
      expect(error?.message).toBe(VIEW_ONLY_MESSAGE);
    }
    expect(saves()).toEqual([]);
  });

  it("refuses the admin client too", async () => {
    const admin = createAdminClient();
    if (!admin) throw new Error("the admin client needs its env");
    const { error } = await admin.from("profiles").update({ active: false });

    expect(error?.code).toBe(VIEW_ONLY_CODE);
    expect(saves()).toEqual([]);
  });

  it("reads still return what that person's session sees", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("mofs").select("id, customer");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: MOF, customer: "Daniel's customer" }]);
    expect(network).toHaveBeenCalledOnce();
  });
});

describe("when nobody is viewing as", () => {
  it("a change goes through", async () => {
    const supabase = await createClient();
    await supabase.from("mofs").update({ id: MOF }).eq("id", MOF);

    expect(saves()).toHaveLength(1);
  });
});
