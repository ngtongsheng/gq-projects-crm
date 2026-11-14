import {
  AttachmentType,
  IMAGE_LONG_EDGE_PX,
  isImageType,
  MAX_ATTACHMENT_BYTES,
} from "./attachment-rules";

const JPEG_QUALITY = 0.85;

/** Size that fits the long edge within maxEdge, keeping the shape. Never enlarges. */
export function fitLongEdge(
  width: number,
  height: number,
  maxEdge: number = IMAGE_LONG_EDGE_PX,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The same name with the extension of the type it was saved as. */
function renamedAsJpeg(name: string): string {
  return `${name.replace(/\.[^./]+$/, "")}.jpg`;
}

/**
 * Browser only. Shrinks a photo to 1100 px on its long edge and saves it as JPEG, so phone photos
 * fit the upload cap. A photo already small enough, and anything that is not a photo (a PDF),
 * is returned as is.
 */
export async function downscaleImage(
  file: File,
  maxEdge: number = IMAGE_LONG_EDGE_PX,
): Promise<File> {
  if (!isImageType(file.type)) return file;

  // Honours the photo's rotation, so a phone photo taken sideways is not saved sideways.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const target = fitLongEdge(bitmap.width, bitmap.height, maxEdge);
    if (
      target.width === bitmap.width &&
      target.height === bitmap.height &&
      file.type === "image/jpeg"
    ) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG has no transparency; without this a transparent PNG would turn black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, target.width, target.height);
    context.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;
    return new File([blob], renamedAsJpeg(file.name), { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export type PreparedFile =
  | { ok: true; file: File }
  | { ok: false; error: string };

/**
 * Browser only. What a person picked, made ready to upload: the type is checked first, photos are
 * shrunk (a 5 MB phone photo is fine), and what is left must fit the 1.5 MB cap, which is the only
 * limit a PDF has.
 */
export async function prepareAttachment(file: File): Promise<PreparedFile> {
  const type = AttachmentType.safeParse(file.type);
  if (!type.success) {
    return { ok: false, error: type.error.issues[0]?.message ?? "Wrong file." };
  }
  const ready = await downscaleImage(file);
  if (ready.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "The file is over 1.5 MB." };
  }
  return { ok: true, file: ready };
}
