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
import { Textarea } from "@/components/ui/textarea";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { addExtraRule } from "./rule-actions";

export function AddRuleDialog({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  function save(formData: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await addExtraRule(formData);
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Rule added."));
      form.reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus data-icon="inline-start" />
          {t("Add rule")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Add a rule")}</DialogTitle>
          <DialogDescription>
            {t(
              "A rule agreed after the appendix was signed. Put it into the next version of the appendix.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ruleStartsOn">{t("Starts on")}</FieldLabel>
              <Input
                id="ruleStartsOn"
                name="startsOn"
                type="date"
                defaultValue={today}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ruleText">{t("Rule")}</FieldLabel>
              <Textarea
                id="ruleText"
                name="rule"
                rows={4}
                maxLength={2000}
                required
              />
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
