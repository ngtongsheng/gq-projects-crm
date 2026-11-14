"use client";

import { Paperclip } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ATTACHMENT_TYPES } from "@/lib/storage/attachment-rules";
import { prepareAttachment } from "@/lib/storage/downscale";

export type UploadOutcome = { ok: true } | { ok: false; error: string };

type FileUploadProps = {
  /** What is being attached, e.g. "MC slip". */
  label: string;
  /** Sends the checked, downscaled file (see uploadToTarget); the module decides where it is recorded. */
  upload: (file: File) => Promise<UploadOutcome>;
  disabled?: boolean;
};

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; name: string }
  | { status: "failed"; error: string };

/** Pick a photo or PDF: photos are shrunk, the type and size are checked, then it is handed to `upload`. */
export function FileUpload({ label, upload, disabled }: FileUploadProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  async function onPick(file: File) {
    setState({ status: "working" });
    const prepared = await prepareAttachment(file);
    if (!prepared.ok) {
      setState({ status: "failed", error: prepared.error });
      return;
    }
    const outcome = await upload(prepared.file);
    setState(
      outcome.ok
        ? { status: "done", name: prepared.file.name }
        : { status: "failed", error: outcome.error },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={ATTACHMENT_TYPES.join(",")}
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
            Photo or PDF, up to 1.5 MB
          </span>
        )}
      </div>
      {state.status === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
