import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "./log-server-error";

function loggedLine(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  expect(spy).toHaveBeenCalledTimes(1);
  const [line] = spy.mock.calls[0] ?? [];
  return JSON.parse(String(line));
}

afterEach(() => vi.restoreAllMocks());

describe("logServerError", () => {
  it("writes one JSON line with message, ids and the error's code, message and details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerError(
      "Could not record the payment",
      { code: "23505", message: "duplicate", details: "Key (id)=(1)" },
      { profileId: "p-1", recordId: "r-1" },
    );
    expect(loggedLine(spy)).toEqual({
      message: "Could not record the payment",
      context: { profileId: "p-1", recordId: "r-1" },
      error: { code: "23505", message: "duplicate", details: "Key (id)=(1)" },
    });
  });

  it("copies nothing else from the error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerError("Could not save", {
      message: "boom",
      email: "a@b.com",
      phone: "012-3456789",
      amount: 1200,
    });
    const line = JSON.stringify(loggedLine(spy));
    expect(line).not.toContain("a@b.com");
    expect(line).not.toContain("012-3456789");
    expect(line).not.toContain("1200");
  });

  it("handles a thrown string or Error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerError("Could not save", "plain failure");
    logServerError("Could not save", new Error("real error"));
    expect(JSON.parse(String(spy.mock.calls[0]?.[0])).error).toEqual({
      message: "plain failure",
    });
    expect(JSON.parse(String(spy.mock.calls[1]?.[0])).error).toEqual({
      message: "real error",
    });
  });
});
