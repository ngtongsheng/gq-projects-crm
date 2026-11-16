"use client";

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
import { FieldError, FieldGroup } from "@/components/ui/field";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { arrangeLeftoverTransport } from "./transport-actions";
import { TransportFields } from "./transport-fields";

/** Purchasing names the Lalamove or lorry for every item of one site still waiting for transport. */
export function ArrangeTransportDialog({
  leftoverIds,
  summary,
  deliverTo,
}: {
  leftoverIds: string[];
  /** The MOF, project and items, so the person sees what the transport is for. */
  summary: string;
  deliverTo: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await arrangeLeftoverTransport(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(
          leftoverIds.length === 1
            ? t("Transport arranged.")
            : `${t("Transport arranged for")} ${leftoverIds.length} ${t("items.")}`,
        );
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="xs" variant="outline">
          {t("Transport arranged")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Arrange transport")}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          {leftoverIds.map((id) => (
            <input key={id} type="hidden" name="leftoverId" value={id} />
          ))}
          <FieldGroup>
            <TransportFields
              idPrefix={`transport-${leftoverIds[0]}`}
              defaults={{ by: "", on: "", to: deliverTo, cost: null }}
              mustName
            />
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
