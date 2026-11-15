"use client";

import { useState } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEFTOVER_TRANSPORTERS } from "@/lib/domain/leftover";

const NOT_ARRANGED = "not-arranged";

export type TransportDefaults = {
  by: string;
  on: string;
  to: string;
  cost: number | null;
};

/**
 * Who takes the stock back by Lalamove or lorry, when, to where and at what cost. In the
 * update form it may stay empty (still to arrange); arranging it is the point of the other dialog.
 */
export function TransportFields({
  idPrefix,
  defaults,
  mustName,
}: {
  idPrefix: string;
  defaults: TransportDefaults;
  mustName: boolean;
}) {
  const [by, setBy] = useState(
    defaults.by || (mustName ? LEFTOVER_TRANSPORTERS[0] : NOT_ARRANGED),
  );
  // A name saved in free text before the list existed stays choosable.
  const names: readonly string[] =
    defaults.by && !LEFTOVER_TRANSPORTERS.some((name) => name === defaults.by)
      ? [defaults.by, ...LEFTOVER_TRANSPORTERS]
      : LEFTOVER_TRANSPORTERS;

  return (
    <FieldGroup>
      <input
        type="hidden"
        name="transportBy"
        value={by === NOT_ARRANGED ? "" : by}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-by`}>Transport</FieldLabel>
          <Select value={by} onValueChange={setBy}>
            <SelectTrigger id={`${idPrefix}-by`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!mustName && (
                <SelectItem value={NOT_ARRANGED}>Still to arrange</SelectItem>
              )}
              {names.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-on`}>Pickup date</FieldLabel>
          <Input
            id={`${idPrefix}-on`}
            name="transportOn"
            type="date"
            defaultValue={defaults.on}
            required={mustName}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-to`}>Deliver to</FieldLabel>
          <Input
            id={`${idPrefix}-to`}
            name="transportTo"
            defaultValue={defaults.to}
            maxLength={100}
            placeholder="e.g. Best Link, Floor Place"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-cost`}>
            Cost (RM, optional)
          </FieldLabel>
          <Input
            id={`${idPrefix}-cost`}
            name="transportCost"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={defaults.cost ?? ""}
          />
        </Field>
      </div>
    </FieldGroup>
  );
}
