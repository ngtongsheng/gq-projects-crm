"use client";

import { Plus } from "lucide-react";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { addFormLink } from "./form-link-actions";

export function AddFormLinkDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  function save(formData: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await addFormLink(formData);
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Form added."));
      form.reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus data-icon="inline-start" />
          {t("Add a form (Google Drive link)")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Add a form")}</DialogTitle>
          <DialogDescription>
            {t(
              'Upload the PDF to Google Drive, set it to "Anyone in GQ with the link can view", then paste the link here.',
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="formLinkName">{t("Form name")}</FieldLabel>
              <Input
                id="formLinkName"
                name="name"
                maxLength={120}
                placeholder={t("e.g. Site inspection checklist")}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="formLinkUrl">
                {t("Google Drive link")}
              </FieldLabel>
              <Input
                id="formLinkUrl"
                name="url"
                type="url"
                maxLength={500}
                placeholder="https://drive.google.com/…"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="formLinkNote">{t("Note")}</FieldLabel>
              <Input
                id="formLinkNote"
                name="note"
                maxLength={200}
                placeholder={t("Who uses it / when")}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Add")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
