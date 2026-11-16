import { describe, expect, it } from "vitest";
import { errorDigest } from "./error-digest";

describe("errorDigest", () => {
  it("reads the digest Next adds to a server error", () => {
    expect(errorDigest(Object.assign(new Error("x"), { digest: "123" }))).toBe(
      "123",
    );
  });

  it("is null when the thrown value has no digest", () => {
    expect(errorDigest(new Error("x"))).toBeNull();
    expect(errorDigest("boom")).toBeNull();
    expect(errorDigest(null)).toBeNull();
    expect(errorDigest({ digest: 5 })).toBeNull();
  });
});
