import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES } from "./attachment-rules";
import { fitLongEdge, prepareAttachment } from "./downscale";

describe("fitLongEdge", () => {
  it("shrinks a landscape photo to 1100 px wide, keeping the shape", () => {
    expect(fitLongEdge(4032, 3024)).toEqual({ width: 1100, height: 825 });
  });

  it("shrinks a portrait photo to 1100 px tall", () => {
    expect(fitLongEdge(3024, 4032)).toEqual({ width: 825, height: 1100 });
  });

  it("leaves a photo already within 1100 px alone, and never enlarges", () => {
    expect(fitLongEdge(1100, 800)).toEqual({ width: 1100, height: 800 });
    expect(fitLongEdge(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it("keeps a very thin image at least 1 px", () => {
    expect(fitLongEdge(20000, 3)).toEqual({ width: 1100, height: 1 });
  });

  it("takes another long edge", () => {
    expect(fitLongEdge(2000, 1000, 500)).toEqual({ width: 500, height: 250 });
  });
});

describe("prepareAttachment", () => {
  const pdf = (bytes: number) =>
    new File([new Uint8Array(bytes)], "policy.pdf", {
      type: "application/pdf",
    });

  it("passes a PDF within the cap through untouched", async () => {
    const file = pdf(1000);
    expect(await prepareAttachment(file)).toEqual({ ok: true, file });
  });

  it("accepts a PDF of exactly 1.5 MB and refuses one byte more", async () => {
    expect((await prepareAttachment(pdf(MAX_ATTACHMENT_BYTES))).ok).toBe(true);
    expect(await prepareAttachment(pdf(MAX_ATTACHMENT_BYTES + 1))).toEqual({
      ok: false,
      error: "The file is over 1.5 MB.",
    });
  });

  it("refuses a file type that is not a photo or PDF", async () => {
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    expect(await prepareAttachment(file)).toEqual({
      ok: false,
      error: "Choose a photo (JPEG, PNG or WebP) or a PDF.",
    });
  });
});
