"use client";

import { FileUpload } from "@/components/app/file-upload";

/** Nothing is stored here: the guide only shows the picker, its checks and its states. */
export function FileUploadDemo() {
  return (
    <FileUpload
      label="MC slip"
      upload={async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return { ok: true };
      }}
    />
  );
}
