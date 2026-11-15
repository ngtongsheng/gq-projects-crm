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
import type { TeamMember } from "@/lib/auth/team-directory";
import {
  guessLeftoverKeepReason,
  LEFTOVER_CONDITION_LABEL,
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATION_LABEL,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_KEEP_REASON_LABEL,
  LEFTOVER_KEEP_REASONS,
  LEFTOVER_RETURN_METHOD_LABEL,
  LEFTOVER_RETURN_METHODS,
  LEFTOVER_STATUS_LABEL,
  LEFTOVER_STATUSES,
  type LeftoverCondition,
  type LeftoverDestination,
  type LeftoverKeepReason,
  type LeftoverReturnMethod,
  type LeftoverStatus,
} from "@/lib/domain/leftover";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { updateLeftover } from "./actions";
import type { Leftover } from "./leftover-data";
import { TransportFields } from "./transport-fields";

const NONE = "none";

/**
 * Purchasing moves an item along: how it goes back and the transport, the supplier or why GQ
 * keeps it, the status, the credit note.
 */
export function UpdateLeftoverDialog({
  leftover,
  people,
  suppliers,
}: {
  leftover: Leftover;
  people: TeamMember[];
  /** Supplier names already in use, offered while typing. */
  suppliers: string[];
}) {
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
  const [returnMethod, setReturnMethod] = useState<LeftoverReturnMethod | "">(
    leftover.returnMethod ?? "",
  );
  const [keepReason, setKeepReason] = useState<LeftoverKeepReason>(
    leftover.keepReason ?? guessLeftoverKeepReason(leftover.item),
  );
  const [orderedWrongBy, setOrderedWrongBy] = useState(
    leftover.orderedWrongBy ?? "",
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
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="leftoverId" value={leftover.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="condition" value={condition} />
          <input type="hidden" name="destination" value={destination} />
          <input type="hidden" name="returnMethod" value={returnMethod} />
          {destination === "gq" && (
            <>
              <input type="hidden" name="keepReason" value={keepReason} />
              <input
                type="hidden"
                name="orderedWrongBy"
                value={keepReason === "ordered_wrong" ? orderedWrongBy : ""}
              />
            </>
          )}
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
              <FieldLabel htmlFor={`method-${leftover.id}`}>
                How it goes back
              </FieldLabel>
              <Select
                value={returnMethod === "" ? NONE : returnMethod}
                onValueChange={(value) => {
                  if (value === NONE) setReturnMethod("");
                  else if (isOneOf(LEFTOVER_RETURN_METHODS, value))
                    setReturnMethod(value);
                }}
              >
                <SelectTrigger id={`method-${leftover.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not said yet</SelectItem>
                  {LEFTOVER_RETURN_METHODS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEFTOVER_RETURN_METHOD_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {returnMethod === "transport" && (
              <TransportFields
                idPrefix={`transport-${leftover.id}`}
                defaults={{
                  by: leftover.transportBy ?? "",
                  on: leftover.transportOn ?? "",
                  to:
                    leftover.transportTo ??
                    (destination === "gq"
                      ? "Best Link"
                      : (leftover.supplier ?? "")),
                  cost: leftover.transportCost,
                }}
                mustName={false}
              />
            )}
            {status === "collected_by_supervisor" && (
              <Field>
                <FieldLabel htmlFor={`collected-to-${leftover.id}`}>
                  Where the supervisor took it
                </FieldLabel>
                <Input
                  id={`collected-to-${leftover.id}`}
                  name="collectedTo"
                  defaultValue={leftover.collectedTo ?? ""}
                  maxLength={100}
                  placeholder="e.g. Best Link, Floor Place"
                />
              </Field>
            )}
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
              <Field>
                <FieldLabel htmlFor={`supplier-${leftover.id}`}>
                  Supplier
                </FieldLabel>
                <Input
                  id={`supplier-${leftover.id}`}
                  name="supplier"
                  list={`suppliers-${leftover.id}`}
                  defaultValue={leftover.supplier ?? ""}
                  maxLength={100}
                  placeholder="e.g. Floor Place"
                />
                <datalist id={`suppliers-${leftover.id}`}>
                  {suppliers.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
            )}
            {destination === "gq" && (
              <>
                <Field>
                  <FieldLabel htmlFor={`keep-${leftover.id}`}>
                    Why GQ keeps it
                  </FieldLabel>
                  <Select
                    value={keepReason}
                    onValueChange={(value) => {
                      if (isOneOf(LEFTOVER_KEEP_REASONS, value))
                        setKeepReason(value);
                    }}
                  >
                    <SelectTrigger id={`keep-${leftover.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEFTOVER_KEEP_REASONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {LEFTOVER_KEEP_REASON_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {keepReason === "ordered_wrong" && (
                  <Field>
                    <FieldLabel htmlFor={`wrong-by-${leftover.id}`}>
                      Ordered by (salesperson)
                    </FieldLabel>
                    <Select
                      value={orderedWrongBy === "" ? NONE : orderedWrongBy}
                      onValueChange={(value) =>
                        setOrderedWrongBy(value === NONE ? "" : value)
                      }
                    >
                      <SelectTrigger id={`wrong-by-${leftover.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not said</SelectItem>
                        {people.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </>
            )}
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
