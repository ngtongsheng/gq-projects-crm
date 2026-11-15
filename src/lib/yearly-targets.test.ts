import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { VIEW_ONLY_CODE } from "@/lib/supabase/view-only-fetch";
import { loadOwnYearlyTarget, refreshYearlyTargets } from "./yearly-targets";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function fakeClient(
  rpcError: { code: string; message: string } | null,
  target: string | null = null,
) {
  const rpc = vi.fn(async () => ({ error: rpcError }));
  const single = vi.fn(async () => ({
    data: { yearly_target: target },
    error: null,
  }));
  vi.mocked(createClient).mockResolvedValue({
    rpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
    })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { rpc };
}

describe("refreshYearlyTargets", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("asks the database to refresh", async () => {
    const { rpc } = fakeClient(null);
    await refreshYearlyTargets();
    expect(rpc).toHaveBeenCalledWith("refresh_yearly_targets");
  });

  it("carries on quietly while the MD is viewing as someone", async () => {
    fakeClient({ code: VIEW_ONLY_CODE, message: "View only – not saved." });
    await refreshYearlyTargets();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs any other failure and still returns", async () => {
    fakeClient({ code: "XX000", message: "boom" });
    await refreshYearlyTargets();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("loadOwnYearlyTarget", () => {
  it("reads the person's target after the refresh as a number", async () => {
    fakeClient(null, "1440000.00");
    expect(await loadOwnYearlyTarget("p1")).toBe(1_440_000);
  });

  it("is null for someone without a target", async () => {
    fakeClient(null, null);
    expect(await loadOwnYearlyTarget("p1")).toBeNull();
  });
});
