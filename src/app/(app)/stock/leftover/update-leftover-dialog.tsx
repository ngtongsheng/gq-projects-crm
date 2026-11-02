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
import {
  LEFTOVER_CONDITION_LABEL,
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATION_LABEL,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_STATUS_LABEL,
  LEFTOVER_STATUSES,
  type LeftoverCondition,
  type LeftoverDestination,
  type LeftoverStatus,
} from "@/lib/domain/leftover";
import { isOneOf } from "@/lib/form/one-of";
import { updateLeftover } from "./actions";
import type { Leftover } from "./leftover-data";

/** Purchasing moves an item along: pickup, return to the supplier, the credit note. */
export function UpdateLeftoverDialog({ leftover }: { leftover: Leftover }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LeftoverStatus>(leftover.status);
  const [condition, setCondition] = useState<LeftoverCondition>(
    leftover.condition,
  );
  const [destination, setDestination] = useState<LeftoverDestination>(
    leftover.destination,
  );

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await updateLeftover(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Leftover stock updated.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Update
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{leftover.item}</DialogTitle>
          <DialogDescription>
            {leftover.mofNo} · {leftover.projectName}
          </DialogDescription>
        </DialogHeader>
        <form action={save}>
          <input type="hidden" name="leftoverId" value={leftover.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="condition" value={condition} />
          <input type="hidden" name="destination" value={destination} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`status-${leftover.id}`}>Status</FieldLabel>
              <Select
                value={status}
                onValueChange={(value) => {
                  if (isOneOf(LEFTOVER_STATUSES, value)) setStatus(value);
                }}
              >
                <SelectTrigger id={`status-${leftover.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEFTOVER_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEFTOVER_STATUS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`destination-${leftover.id}`}>
                Goes to
              </FieldLabel>
              <Select
                value={destination}
                onValueChange={(value) => {
                  if (isOneOf(LEFTOVER_DESTINATIONS, value))
                    setDestination(value);
                }}
              >
                <SelectTrigger id={`destination-${leftover.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEFTOVER_DESTINATIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEFTOVER_DESTINATION_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {destination === "supplier" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`cn-${leftover.id}`}>
                    Supplier credit note no.
                  </FieldLabel>
                  <Input
                    id={`cn-${leftover.id}`}
                    name="creditNoteNo"
                    defaultValue={leftover.creditNoteNo ?? ""}
                    maxLength={60}
                    placeholder="e.g. CN-2026-0412"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`cn-amount-${leftover.id}`}>
                    Credit note amount (RM)
                  </FieldLabel>
                  <Input
                    id={`cn-amount-${leftover.id}`}
                    name="creditNoteAmount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={leftover.creditNoteAmount ?? ""}
                  />
                </Field>
              </div>
            )}
            <Field>
              <FieldLabel htmlFor={`condition-${leftover.id}`}>
                Condition
              </FieldLabel>
              <Select
                value={condition}
                onValueChange={(value) => {
                  if (isOneOf(LEFTOVER_CONDITIONS, value)) setCondition(value);
                }}
              >
                <SelectTrigger id={`condition-${leftover.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEFTOVER_CONDITIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEFTOVER_CONDITION_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`note-${leftover.id}`}>Note</FieldLabel>
              <Input
                id={`note-${leftover.id}`}
                name="note"
                defaultValue={leftover.note}
                maxLength={300}
              />
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
