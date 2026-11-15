"use client";

import { Settings } from "lucide-react";
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
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import {
  savePickupSettings,
  setNextPickupNumber,
} from "./pickup-settings-actions";
import type { PickupSettings } from "./samples-data";

/** Best Link's WhatsApp number, the Drive folder the forms are kept in, and the next form number. */
export function PickupSettingsDialog({
  settings,
}: {
  settings: PickupSettings;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const saved = await savePickupSettings(formData);
      if (saved.error) {
        setError(saved.error);
        return;
      }
      // The number only moves when it was changed; the database refuses one that is too low.
      const nextNo = String(formData.get("nextNo") ?? "").trim();
      if (nextNo !== String(settings.nextNo)) {
        const set = await setNextPickupNumber(formData);
        if (set.error) {
          setError(`Settings saved, but the form number was not: ${set.error}`);
          return;
        }
      }
      setError(null);
      toast.success("Settings saved.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings data-icon="inline-start" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pickup form settings</DialogTitle>
          <DialogDescription>
            Used on every Best Link pickup form.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bestLinkWhatsapp">
                Best Link WhatsApp no.
              </FieldLabel>
              <Input
                id="bestLinkWhatsapp"
                name="bestLinkWhatsapp"
                inputMode="tel"
                defaultValue={settings.bestLinkWhatsapp ?? ""}
                placeholder="e.g. 012-3723925"
              />
              <FieldDescription>
                The WhatsApp button on a form opens a chat with this number.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="driveFolderUrl">
                Drive folder link
              </FieldLabel>
              <Input
                id="driveFolderUrl"
                name="driveFolderUrl"
                inputMode="url"
                defaultValue={settings.driveFolderUrl ?? ""}
                placeholder="https://drive.google.com/drive/folders/..."
              />
              <FieldDescription>
                Where admin keeps the Best Link pickup forms.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="nextPickupNo">Next form no.</FieldLabel>
              <Input
                id="nextPickupNo"
                name="nextNo"
                className="font-mono"
                inputMode="numeric"
                defaultValue={settings.nextNo}
                required
              />
              <FieldDescription>
                Use this once to continue from your last paper form. It must be
                higher than the last number used or cancelled.
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
