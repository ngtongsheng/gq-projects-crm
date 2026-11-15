"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALLOWANCE_LABEL,
  ALLOWANCE_TYPES,
  type Allowance,
  type AllowanceType,
} from "@/lib/domain/staff-package";
import { useT } from "@/lib/i18n/language-context";

/** An allowance row while it is being typed: the amount stays text until saved. */
export type AllowanceDraft = {
  /** Identifies the row while it is edited or removed; never saved. */
  key: number;
  name: AllowanceType;
  amount: string;
};

let lastKey = 0;
const newKey = () => {
  lastKey += 1;
  return lastKey;
};

export const toDrafts = (allowances: readonly Allowance[]): AllowanceDraft[] =>
  allowances.map((allowance) => ({
    key: newKey(),
    name: allowance.name,
    amount: String(allowance.amount),
  }));

/** Blank rows are dropped, as in the demo; anything else is checked by the save. */
export const fromDrafts = (drafts: readonly AllowanceDraft[]): Allowance[] =>
  drafts
    .filter((draft) => draft.amount.trim() !== "" && Number(draft.amount) !== 0)
    .map((draft) => ({ name: draft.name, amount: Number(draft.amount) }));

export function AllowanceEditor({
  value,
  onChange,
}: {
  value: AllowanceDraft[];
  onChange: (next: AllowanceDraft[]) => void;
}) {
  const t = useT();
  const change = (index: number, patch: Partial<AllowanceDraft>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("No allowance")}</p>
      )}
      {value.map((row, index) => (
        <div key={row.key} className="flex items-center gap-2">
          <Select
            value={row.name}
            onValueChange={(name) =>
              change(index, { name: name as AllowanceType })
            }
          >
            <SelectTrigger
              className="min-w-0 flex-1"
              aria-label={t("Allowance type")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALLOWANCE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(ALLOWANCE_LABEL[type])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className="w-28 font-mono tabular-nums"
            aria-label={t("Allowance amount (RM)")}
            placeholder="RM"
            value={row.amount}
            onChange={(event) => change(index, { amount: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("Remove allowance")}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...value,
              { key: newKey(), name: ALLOWANCE_TYPES[0], amount: "" },
            ])
          }
        >
          <Plus data-icon="inline-start" />
          {t("Add allowance")}
        </Button>
      </div>
    </div>
  );
}
