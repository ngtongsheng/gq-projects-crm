import { describe, expect, it, vi } from "vitest";
import { createUploadTarget } from "./upload";

const RECORD = "3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f";
const request = {
  area: "claims",
  recordId: RECORD,
  fileName: "receipt.pdf",
  contentType: "application/pdf",
  size: 90_000,
};

function signer(
  result: {
    data: { token: string; path: string } | null;
    error: { message: string } | null;
  } = { data: { token: "tok", path: "x" }, error: null },
) {
  const createSignedUploadUrl = vi.fn(async (path: string) =>
    result.data ? { data: { ...result.data, path }, error: null } : result,
  );
  const from = vi.fn(() => ({ createSignedUploadUrl }));
  return { client: { storage: { from } }, from, createSignedUploadUrl };
}

describe("createUploadTarget", () => {
  it("signs one path under the attachments bucket and returns it with the token", async () => {
    const { client, from, createSignedUploadUrl } = signer();
    const result = await createUploadTarget(client, request);

    expect(from).toHaveBeenCalledWith("attachments");
    const path = createSignedUploadUrl.mock.calls[0]?.[0];
    expect(path).toMatch(
      new RegExp(`^claims/${RECORD}/[0-9a-f]{8}-receipt.pdf$`),
    );
    expect(result).toEqual({ ok: true, target: { path, token: "tok" } });
  });

  it("signs nothing for a file that fails validation", async () => {
    const { client, createSignedUploadUrl } = signer();
    const tooBig = await createUploadTarget(client, {
      ...request,
      size: 2_000_000,
    });
    const wrongType = await createUploadTarget(client, {
      ...request,
      contentType: "text/html",
    });
    const junk = await createUploadTarget(client, null);

    expect(tooBig).toEqual({ ok: false, error: "The file is over 1.5 MB." });
    expect(wrongType.ok).toBe(false);
    expect(junk.ok).toBe(false);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("gives a plain message when storage refuses, and keeps the detail in the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = signer({ data: null, error: { message: "denied" } });
    const result = await createUploadTarget(client, request);

    expect(result).toEqual({
      ok: false,
      error: "Could not upload the file. Try again.",
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
