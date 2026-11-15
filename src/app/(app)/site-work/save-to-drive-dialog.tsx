"use client";

import { FolderCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/language-context";
import { savePhotosToDrive } from "./measurement-photo-actions";

/**
 * "Saved to Drive": sales support pastes the job's Drive folder link once the photos from the
 * WhatsApp group are in it. Also changes the link afterwards (`saved`).
 */
export function SaveToDriveDialog({
  siteLogId,
  summary,
  initialLink,
  saved,
}: {
  siteLogId: string;
  /** "MOF · project · shooting 12 Nov by Awal", so they know which job this is. */
  summary: string;
  initialLink: string;
  saved: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(initialLink);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await savePhotosToDrive({ siteLogId, link });
      setError(result.error);
      if (!result.error) {
        toast.success(t("Saved to Drive."));
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {saved ? (
          <Button size="sm" variant="ghost">
            {t("Change link")}
          </Button>
        ) : (
          <Button size="sm">
            <FolderCheck data-icon="inline-start" />
            {t("Saved to Drive")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t(saved ? "Drive folder link" : "Saved to Drive")}
          </DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`drive-link-${siteLogId}`}>
                {t("Google Drive folder link")}
              </FieldLabel>
              <Input
                id={`drive-link-${siteLogId}`}
                type="url"
                required
                value={link}
                placeholder="https://drive.google.com/drive/folders/..."
                onChange={(event) => setLink(event.target.value)}
              />
              <FieldDescription>
                {t(
                  "In Google Drive, open the job site folder, click Share, then Copy link, and paste it here.",
                )}
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending
                ? t("Saving...")
                : t(saved ? "Save link" : "Confirm saved")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
