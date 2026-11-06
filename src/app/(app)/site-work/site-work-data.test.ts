import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { loadTodaysSiteIds } from "./site-work-data";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function fakeJobs(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const calls: [string, ...unknown[]][] = [];
  const query: Record<string, unknown> = {};
  for (const step of ["select", "eq", "lte", "gte"]) {
    query[step] = (...args: unknown[]) => {
      calls.push([step, ...args]);
      return query;
    };
  }
  query.neq = async (...args: unknown[]) => {
    calls.push(["neq", ...args]);
    return result;
  };
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => query),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return calls;
}

const SUPERVISOR = "11111111-1111-4111-8111-111111111111";

describe("loadTodaysSiteIds", () => {
  it("asks for this supervisor's jobs running today that are not postponed", async () => {
    const calls = fakeJobs({ data: [], error: null });

    await loadTodaysSiteIds(SUPERVISOR, "2026-11-06");

    expect(calls).toEqual([
      ["select", "mof_id"],
      ["eq", "site_supervisor_id", SUPERVISOR],
      ["lte", "scheduled_on", "2026-11-06"],
      ["gte", "ends_on", "2026-11-06"],
      ["neq", "status", "postponed"],
    ]);
  });

  it("gives each project once, even with several jobs on it", async () => {
    fakeJobs({
      data: [{ mof_id: "a" }, { mof_id: "b" }, { mof_id: "a" }],
      error: null,
    });

    expect(await loadTodaysSiteIds(SUPERVISOR, "2026-11-06")).toEqual([
      "a",
      "b",
    ]);
  });

  it("says plainly when the jobs cannot be read", async () => {
    fakeJobs({ data: null, error: { message: "boom" } });

    await expect(loadTodaysSiteIds(SUPERVISOR, "2026-11-06")).rejects.toThrow(
      "Could not load today's jobs: boom",
    );
  });
});
