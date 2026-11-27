import { describe, expect, it } from "vitest";
import { PAGE_SIZE, readAllRows } from "./read-all-rows";

/** A table of `count` rows that serves at most PAGE_SIZE rows a request, like the API. */
function table(count: number) {
  const rows = Array.from({ length: count }, (_, id) => ({ id }));
  const calls: { from: number; to: number; stable: boolean }[] = [];
  const read = async (from: number, to: number, stable: boolean) => {
    calls.push({ from, to, stable });
    return {
      data: rows.slice(from, Math.min(to + 1, from + PAGE_SIZE)),
      error: null,
    };
  };
  return { rows, calls, read };
}

describe("readAllRows", () => {
  it("reads a table under one page once, with no extra order", async () => {
    const { rows, calls, read } = table(3);
    expect(await readAllRows(read)).toEqual({ data: rows, error: null });
    expect(calls).toEqual([{ from: 0, to: PAGE_SIZE - 1, stable: false }]);
  });

  it("returns every row past the first page, in stable pages", async () => {
    const { rows, calls, read } = table(2 * PAGE_SIZE + 500);
    const result = await readAllRows(read);
    expect(result.data).toHaveLength(2 * PAGE_SIZE + 500);
    expect(result.data).toEqual(rows);
    expect(calls.slice(1).every((call) => call.stable)).toBe(true);
  });

  it("asks for the next page when the last one was exactly full", async () => {
    const { calls, read } = table(PAGE_SIZE);
    expect((await readAllRows(read)).data).toHaveLength(PAGE_SIZE);
    expect(calls.map((call) => call.from)).toEqual([0, 0, PAGE_SIZE]);
  });

  it("reports an error on a later page instead of a short list", async () => {
    const { read } = table(PAGE_SIZE + 10);
    const failing = async (from: number, to: number, stable: boolean) =>
      from > 0
        ? { data: null, error: { message: "timeout" } }
        : read(from, to, stable);
    expect(await readAllRows(failing)).toEqual({
      data: null,
      error: { message: "timeout" },
    });
  });
});
