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
import { useT } from "@/lib/i18n/language-context";
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
  const t = useT();
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
          setError(
            `${t("Settings saved, but the form number was not:")} ${set.error}`,
          );
          return;
        }
      }
      setError(null);
      toast.success(t("Settings saved."));
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings data-icon="inline-start" />
          {t("Settings")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Pickup form settings")}</DialogTitle>
          <DialogDescription>
            {t("Used on every Best Link pickup form.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bestLinkWhatsapp">
                {t("Best Link WhatsApp no.")}
              </FieldLabel>
              <Input
                id="bestLinkWhatsapp"
                name="bestLinkWhatsapp"
                inputMode="tel"
                defaultValue={settings.bestLinkWhatsapp ?? ""}
                placeholder="e.g. 012-3723925"
              />
              <FieldDescription>
                {t(
                  "The WhatsApp button on a form opens a chat with this number.",
                )}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="driveFolderUrl">
                {t("Drive folder link")}
              </FieldLabel>
              <Input
                id="driveFolderUrl"
                name="driveFolderUrl"
                inputMode="url"
                defaultValue={settings.driveFolderUrl ?? ""}
                placeholder={t("https://drive.google.com/drive/folders/...")}
              />
              <FieldDescription>
                {t("Where admin keeps the Best Link pickup forms.")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="nextPickupNo">
                {t("Next form no.")}
              </FieldLabel>
              <Input
                id="nextPickupNo"
                name="nextNo"
                className="font-mono"
                inputMode="numeric"
                defaultValue={settings.nextNo}
                required
              />
              <FieldDescription>
                {t(
                  "Use this once to continue from your last paper form. It must be higher than the last number used or cancelled.",
                )}
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Save")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
