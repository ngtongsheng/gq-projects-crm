"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { textField } from "@/lib/form/form-fields";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import {
  deleteMarketingEventCost,
  saveMarketingEventCost,
} from "./marketing-event-actions";
import type { EventCostLine, MarketingEventOption } from "./marketing-types";

type MarketingEventCostDialogProps = {
  /** The cost line being edited; leave out to add one. */
  line?: EventCostLine;
  events: readonly MarketingEventOption[];
  /** The event the line belongs to, or the one open on the page when adding. */
  eventId: string;
  /** Cost groups already used, offered while typing. */
  groups: readonly string[];
  onClose: () => void;
};

/** Adds or edits a line of an event's cost sheet (demo sheetMkEvt). Mounted while open. */
export function MarketingEventCostDialog({
  line,
  events,
  eventId: startEventId,
  groups,
  onClose,
}: MarketingEventCostDialogProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [eventId, setEventId] = useState(startEventId);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveMarketingEventCost({
        id: line?.id ?? "",
        eventId,
        costGroup: textField(formData, "costGroup"),
        description: textField(formData, "description"),
        supplierRef: textField(formData, "supplierRef"),
        foreignAmount: textField(formData, "foreignAmount"),
        rate: textField(formData, "rate"),
        unit: textField(formData, "unit"),
        qty: textField(formData, "qty"),
        remarks: textField(formData, "remarks"),
      });
      setError(result.error);
      if (result.error !== null) return;
      toast.success(line ? t("Saved") : t("Cost added"));
      onClose();
    });
  }

  function remove() {
    if (!line) return;
    startTransition(async () => {
      const result = await deleteMarketingEventCost(line.id);
      setError(result.error);
      setAsking(false);
      if (result.error !== null) return;
      toast.success(t("Cost deleted."));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{line ? t("Edit cost") : t("Add cost")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="costEvent">{t("Event")} *</FieldLabel>
                <Select value={eventId} onValueChange={setEventId}>
                  <SelectTrigger id="costEvent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="costGroup">{t("Cost group")} *</FieldLabel>
                <Input
                  id="costGroup"
                  name="costGroup"
                  list="costGroups"
                  defaultValue={line?.costGroup}
                  maxLength={100}
                  required
                />
                <datalist id="costGroups">
                  {groups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="costDescription">
                {t("Description")}
              </FieldLabel>
              <Input
                id="costDescription"
                name="description"
                defaultValue={line?.description ?? ""}
                maxLength={300}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="costSupplier">
                  {t("Supplier / ref")}
                </FieldLabel>
                <Input
                  id="costSupplier"
                  name="supplierRef"
                  defaultValue={line?.supplierRef ?? ""}
                  maxLength={200}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="costForeign">
                  {t("Foreign amount")}
                </FieldLabel>
                <Input
                  id="costForeign"
                  name="foreignAmount"
                  placeholder="RMB 2700"
                  defaultValue={line?.foreignAmount ?? ""}
                  maxLength={100}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="costRate">{t("Rate (RM)")} *</FieldLabel>
                <Input
                  id="costRate"
                  name="rate"
                  inputMode="decimal"
                  defaultValue={line?.rate ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="costUnit">{t("Unit")}</FieldLabel>
                <Input
                  id="costUnit"
                  name="unit"
                  defaultValue={line?.unit ?? "ls"}
                  maxLength={20}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="costQty">{t("Qty")}</FieldLabel>
                <Input
                  id="costQty"
                  name="qty"
                  inputMode="decimal"
                  defaultValue={line?.qty ?? 1}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="costRemarks">{t("Remarks")}</FieldLabel>
              <Textarea
                id="costRemarks"
                name="remarks"
                rows={2}
                defaultValue={line?.remarks ?? ""}
                maxLength={1000}
              />
            </Field>
            {error && <FieldError>{t(error)}</FieldError>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? t("Saving...") : t("Save")}
              </Button>
              {line &&
                (asking ? (
                  <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                    {t("Delete this cost?")}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={remove}
                      disabled={pending}
                    >
                      {t("Yes, delete")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAsking(false)}
                    >
                      {t("Keep")}
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-auto text-bad"
                    onClick={() => setAsking(true)}
                  >
                    {t("Delete")}
                  </Button>
                ))}
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
