import { describe, expect, it, vi } from "vitest";
import {
  createReadLink,
  createReadLinks,
  READ_LINK_SECONDS,
} from "./signed-url";

const PATH = "leave/3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f/ab12cd34-mc-slip.jpg";

function signer(
  result: {
    data: { signedUrl: string } | null;
    error: { message: string } | null;
  } = { data: { signedUrl: "https://files.example/signed" }, error: null },
) {
  const createSignedUrl = vi.fn(async () => result);
  const from = vi.fn(() => ({ createSignedUrl }));
  return { client: { storage: { from } }, from, createSignedUrl };
}

describe("createReadLink", () => {
  it("returns a link that expires in minutes, not days", async () => {
    const { client, from, createSignedUrl } = signer();
    const result = await createReadLink(client, PATH);

    expect(result).toEqual({ ok: true, url: "https://files.example/signed" });
    expect(from).toHaveBeenCalledWith("attachments");
    expect(createSignedUrl).toHaveBeenCalledWith(PATH, READ_LINK_SECONDS);
    expect(READ_LINK_SECONDS).toBeLessThanOrEqual(600);
  });

  it("signs nothing for a path that is not a stored file", async () => {
    const { client, createSignedUrl } = signer();
    for (const path of ["", "../etc/passwd", "leave/x/y.png", `${PATH}/..`]) {
      expect(await createReadLink(client, path)).toEqual({
        ok: false,
        error: "That file is not available.",
      });
    }
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("says the file is not available when storage cannot sign it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = signer({ data: null, error: { message: "not found" } });
    expect(await createReadLink(client, PATH)).toEqual({
      ok: false,
      error: "That file is not available.",
    });
    log.mockRestore();
  });
});

describe("createReadLinks", () => {
  const OTHER =
    "leave/3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f/cd56ef78-receipt.png";

  function batchSigner(result: {
    data: { path: string | null; signedUrl: string | null }[] | null;
    error: { message: string } | null;
  }) {
    const createSignedUrls = vi.fn(async () => result);
    const from = vi.fn(() => ({ createSignedUrls }));
    return { client: { storage: { from } }, from, createSignedUrls };
  }

  it("signs every stored file in one request, by path", async () => {
    const { client, from, createSignedUrls } = batchSigner({
      data: [
        { path: PATH, signedUrl: "https://files.example/a" },
        { path: OTHER, signedUrl: "https://files.example/b" },
      ],
      error: null,
    });
    const links = await createReadLinks(client, [
      PATH,
      "../etc/passwd",
      OTHER,
      PATH,
    ]);

    expect(links).toEqual(
      new Map([
        [PATH, "https://files.example/a"],
        [OTHER, "https://files.example/b"],
      ]),
    );
    expect(from).toHaveBeenCalledWith("attachments");
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(
      [PATH, OTHER],
      READ_LINK_SECONDS,
    );
  });

  it("makes no request when there is nothing to sign", async () => {
    const { client, createSignedUrls } = batchSigner({ data: [], error: null });
    expect(await createReadLinks(client, ["", "leave/x/y.png"])).toEqual(
      new Map(),
    );
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("leaves out files storage cannot sign", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const partial = batchSigner({
      data: [
        { path: PATH, signedUrl: "https://files.example/a" },
        { path: OTHER, signedUrl: null },
      ],
      error: null,
    });
    expect(await createReadLinks(partial.client, [PATH, OTHER])).toEqual(
      new Map([[PATH, "https://files.example/a"]]),
    );
    const failed = batchSigner({ data: null, error: { message: "down" } });
    expect(await createReadLinks(failed.client, [PATH])).toEqual(new Map());
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
