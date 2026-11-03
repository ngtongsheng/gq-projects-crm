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
  FieldDescription,
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
  LEFTOVER_UNIT_LABEL,
  LEFTOVER_UNITS,
  type LeftoverCondition,
  type LeftoverDestination,
  type LeftoverUnit,
  suggestLeftoverDestination,
} from "@/lib/domain/leftover";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { recordLeftover } from "./actions";

/** Records an item left over at the site. Purchasing arranges the pickup afterwards. */
export function RecordLeftoverDialog({ mofId }: { mofId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState("");
  const [unit, setUnit] = useState<LeftoverUnit>("box");
  const [condition, setCondition] = useState<LeftoverCondition>("good");
  const [destination, setDestination] =
    useState<LeftoverDestination>("supplier");
  // Once she picks a destination herself, typing the item no longer changes it.
  const [destinationChosen, setDestinationChosen] = useState(false);

  function suggest(nextItem: string, nextUnit: LeftoverUnit) {
    if (!destinationChosen) {
      setDestination(suggestLeftoverDestination(nextItem, nextUnit));
    }
  }

  function reset() {
    setItem("");
    setUnit("box");
    setCondition("good");
    setDestination("supplier");
    setDestinationChosen(false);
    setError(null);
  }

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await recordLeftover(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Leftover stock recorded.");
        setOpen(false);
        reset();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus data-icon="inline-start" />
          Record leftover
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record leftover stock</DialogTitle>
          <DialogDescription>
            One line per item left over after the job. Purchasing arranges the
            pickup.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="mofId" value={mofId} />
          <input type="hidden" name="unit" value={unit} />
          <input type="hidden" name="condition" value={condition} />
          <input type="hidden" name="destination" value={destination} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="leftoverItem">Item</FieldLabel>
              <Input
                id="leftoverItem"
                name="item"
                value={item}
                onChange={(event) => {
                  setItem(event.target.value);
                  suggest(event.target.value, unit);
                }}
                maxLength={200}
                placeholder="e.g. Carpet tile 50x50 cm, Grey"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="leftoverQty">Quantity</FieldLabel>
                <Input
                  id="leftoverQty"
                  name="qty"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="leftoverUnit">Unit</FieldLabel>
                <Select
                  value={unit}
                  onValueChange={(value) => {
                    if (!isOneOf(LEFTOVER_UNITS, value)) return;
                    setUnit(value);
                    suggest(item, value);
                  }}
                >
                  <SelectTrigger id="leftoverUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEFTOVER_UNITS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {LEFTOVER_UNIT_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="leftoverCondition">Condition</FieldLabel>
              <Select
                value={condition}
                onValueChange={(value) => {
                  if (isOneOf(LEFTOVER_CONDITIONS, value)) setCondition(value);
                }}
              >
                <SelectTrigger id="leftoverCondition">
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
              <FieldLabel htmlFor="leftoverDestination">Goes to</FieldLabel>
              <Select
                value={destination}
                onValueChange={(value) => {
                  if (!isOneOf(LEFTOVER_DESTINATIONS, value)) return;
                  setDestination(value);
                  setDestinationChosen(true);
                }}
              >
                <SelectTrigger id="leftoverDestination">
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
              <FieldDescription>
                Filled in from the item; change it if it is wrong.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="leftoverNote">Note</FieldLabel>
              <Input
                id="leftoverNote"
                name="note"
                maxLength={300}
                placeholder="e.g. Stored at client's store room"
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save leftover"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
