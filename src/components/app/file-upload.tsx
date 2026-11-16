"use client";

import { Paperclip } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import { attachFile } from "@/lib/storage/attach-file";
import { ATTACHMENT_TYPES, IMAGE_TYPES } from "@/lib/storage/attachment-rules";

export type UploadOutcome = { ok: true } | { ok: false; error: string };

type FileUploadProps = {
  /** What is being attached, e.g. "MC slip". */
  label: string;
  /** Sends the checked, downscaled file (see uploadToTarget); the module decides where it is recorded. */
  upload: (file: File) => Promise<UploadOutcome>;
  disabled?: boolean;
  /** Photos only, e.g. a claim receipt; the picker and the hint leave out PDF. */
  imagesOnly?: boolean;
};

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; name: string }
  | { status: "failed"; error: string };

/** Pick a photo or PDF: photos are shrunk, the type and size are checked, then it is handed to `upload`. */
export function FileUpload({
  label,
  upload,
  disabled,
  imagesOnly = false,
}: FileUploadProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const t = useT();

  async function onPick(file: File) {
    setState({ status: "working" });
    const outcome = await attachFile(file, upload);
    setState(
      outcome.ok
        ? { status: "done", name: outcome.name }
        : { status: "failed", error: outcome.error },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={(imagesOnly ? IMAGE_TYPES : ATTACHMENT_TYPES).join(",")}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onPick(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || state.status === "working"}
          onClick={() => input.current?.click()}
        >
          <Paperclip data-icon="inline-start" />
          {state.status === "working"
            ? "Uploading..."
            : state.status === "done"
              ? `Replace ${label}`
              : `Attach ${label}`}
        </Button>
        {state.status === "done" ? (
          <span className="text-sm text-good">{state.name} attached</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {imagesOnly ? "Photo, up to 1.5 MB" : "Photo or PDF, up to 1.5 MB"}
          </span>
        )}
      </div>
      {state.status === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </div>
  );
}
