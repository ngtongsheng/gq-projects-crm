import { describe, expect, it } from "vitest";
import {
  AttachmentPath,
  AttachmentType,
  buildAttachmentPath,
  IMAGE_LONG_EDGE_PX,
  isImageType,
  MAX_ATTACHMENT_BYTES,
  UploadRequest,
} from "./attachment-rules";

const RECORD = "3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f";
const valid = {
  area: "leave",
  recordId: RECORD,
  fileName: "MC slip.jpg",
  contentType: "image/jpeg",
  size: 200_000,
};

describe("UploadRequest", () => {
  it("accepts a photo or a PDF within the cap", () => {
    expect(UploadRequest.safeParse(valid).success).toBe(true);
    expect(
      UploadRequest.safeParse({ ...valid, contentType: "application/pdf" })
        .success,
    ).toBe(true);
  });

  it("accepts a file of exactly 1.5 MB and refuses one byte more", () => {
    expect(
      UploadRequest.safeParse({ ...valid, size: MAX_ATTACHMENT_BYTES }).success,
    ).toBe(true);
    const over = UploadRequest.safeParse({
      ...valid,
      size: MAX_ATTACHMENT_BYTES + 1,
    });
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe("The file is over 1.5 MB.");
  });

  it.each([
    "image/gif",
    "image/svg+xml",
    "text/html",
    "application/zip",
    "",
  ])("refuses %j", (contentType) => {
    const result = UploadRequest.safeParse({ ...valid, contentType });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Choose a photo (JPEG, PNG or WebP) or a PDF.",
    );
  });

  it("refuses an empty file, a fractional size and a missing size", () => {
    expect(UploadRequest.safeParse({ ...valid, size: 0 }).success).toBe(false);
    expect(UploadRequest.safeParse({ ...valid, size: 10.5 }).success).toBe(
      false,
    );
    expect(UploadRequest.safeParse({ ...valid, size: undefined }).success).toBe(
      false,
    );
  });

  it("refuses an area or record id that could reach another folder", () => {
    for (const area of ["../hr", "Leave", "leave/x", "", "1leave"]) {
      expect(UploadRequest.safeParse({ ...valid, area }).success).toBe(false);
    }
    expect(
      UploadRequest.safeParse({ ...valid, recordId: "../secret" }).success,
    ).toBe(false);
  });
});

describe("isImageType and AttachmentType", () => {
  it("tells photos from PDFs", () => {
    expect(isImageType("image/png")).toBe(true);
    expect(isImageType("application/pdf")).toBe(false);
    expect(AttachmentType.safeParse("application/pdf").success).toBe(true);
  });
});

describe("buildAttachmentPath", () => {
  const ids = () => "ab12cd34";

  it("builds <area>/<record-id>/<random>-<file>", () => {
    expect(buildAttachmentPath(valid, ids)).toBe(
      `leave/${RECORD}/ab12cd34-mc-slip.jpg`,
    );
  });

  it("makes the file name safe for a path", () => {
    const path = buildAttachmentPath(
      { ...valid, fileName: "../../Receipt (final) #2 — Ünï.PDF" },
      ids,
    );
    expect(path).toBe(`leave/${RECORD}/ab12cd34-receipt-final-2-n.pdf`);
    expect(AttachmentPath.safeParse(path).success).toBe(true);
  });

  it("keeps a long name within bounds and never ends up empty", () => {
    const long = buildAttachmentPath(
      { ...valid, fileName: `${"a".repeat(300)}.pdf` },
      ids,
    );
    expect(long.split("/")[2]?.length).toBeLessThanOrEqual(80 + 9);
    expect(buildAttachmentPath({ ...valid, fileName: "###" }, ids)).toBe(
      `leave/${RECORD}/ab12cd34-file`,
    );
  });

  it("gives every call a different path", () => {
    expect(buildAttachmentPath(valid)).not.toBe(buildAttachmentPath(valid));
    expect(AttachmentPath.safeParse(buildAttachmentPath(valid)).success).toBe(
      true,
    );
  });
});

describe("AttachmentPath", () => {
  it("accepts the stored shape and nothing else", () => {
    expect(AttachmentPath.safeParse(`tasks/${RECORD}/a1-b.png`).success).toBe(
      true,
    );
    for (const path of [
      "a1-b.png",
      `leave/${RECORD}/..`,
      `leave/${RECORD}/../x`,
      `leave/${RECORD}/a/b.png`,
      `../${RECORD}/b.png`,
      `leave/not-an-id/b.png`,
      `leave/${RECORD}/B.png`,
    ]) {
      expect(AttachmentPath.safeParse(path).success).toBe(false);
    }
  });
});

describe("limits", () => {
  it("downscales to the demo's 1100 px", () => {
    expect(IMAGE_LONG_EDGE_PX).toBe(1100);
  });
});
