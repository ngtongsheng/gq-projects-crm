"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DeleteConfirm } from "@/components/app/delete-confirm";
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
import { Textarea } from "@/components/ui/textarea";
import { textField } from "@/lib/form/form-fields";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import {
  deleteMarketingEvent,
  saveMarketingEvent,
} from "./marketing-event-actions";
import type { MarketingEvent } from "./marketing-types";

type MarketingEventDialogProps = {
  /** The event being edited; leave out to create one. */
  event?: MarketingEvent;
  /** Cost lines plus tagged expenses; the database blocks a delete while this is above 0. */
  used: number;
  /** Called with the saved event's id, so a new event opens straight away. */
  onSaved: (id: string) => void;
  onDeleted: () => void;
  onClose: () => void;
};

/** Creates or edits an event (demo sheetMkEvent). Mounted while open, so each opening starts from the event. */
export function MarketingEventDialog({
  event,
  used,
  onSaved,
  onDeleted,
  onClose,
}: MarketingEventDialogProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveMarketingEvent({
        id: event?.id ?? "",
        name: textField(formData, "name"),
        startsOn: textField(formData, "startsOn"),
        endsOn: textField(formData, "endsOn"),
        venue: textField(formData, "venue"),
        budget: textField(formData, "budget"),
        notes: textField(formData, "notes"),
      });
      setError(result.error);
      if (result.error !== null || !result.id) return;
      toast.success(event ? t("Saved") : t("Event created"));
      onSaved(result.id);
      onClose();
    });
  }

  function remove() {
    if (!event) return;
    startTransition(async () => {
      const result = await deleteMarketingEvent(event.id);
      setError(result.error);
      setAsking(false);
      if (result.error !== null) return;
      toast.success(t("Event deleted."));
      onDeleted();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event ? t("Edit event") : t("Create event")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="eventName">{t("Event name")} *</FieldLabel>
              <Input
                id="eventName"
                name="name"
                defaultValue={event?.name}
                maxLength={200}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="eventStart">{t("Start date")}</FieldLabel>
                <Input
                  id="eventStart"
                  name="startsOn"
                  type="date"
                  defaultValue={event?.startsOn ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="eventEnd">{t("End date")}</FieldLabel>
                <Input
                  id="eventEnd"
                  name="endsOn"
                  type="date"
                  defaultValue={event?.endsOn ?? ""}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="eventVenue">{t("Venue")}</FieldLabel>
                <Input
                  id="eventVenue"
                  name="venue"
                  defaultValue={event?.venue ?? ""}
                  maxLength={200}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="eventBudget">
                  {t("Budget (RM)")}
                </FieldLabel>
                <Input
                  id="eventBudget"
                  name="budget"
                  inputMode="decimal"
                  defaultValue={event?.budget ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="eventNotes">{t("Notes")}</FieldLabel>
              <Textarea
                id="eventNotes"
                name="notes"
                rows={2}
                defaultValue={event?.notes ?? ""}
                maxLength={1000}
              />
            </Field>
            {error && <FieldError>{t(error)}</FieldError>}
            <DeleteConfirm
              pending={pending}
              showDelete={event !== undefined}
              inUse={used > 0}
              question={t("Delete this event?")}
              asking={asking}
              onAskingChange={setAsking}
              onDelete={remove}
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
