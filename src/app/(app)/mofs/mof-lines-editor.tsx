"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { m2ToSqft, sqftToM2 } from "@/lib/domain/area";
import { totalAreaM2 } from "@/lib/domain/mof-totals";
import { formatQuantity } from "@/lib/format/quantity";
import { LineUnit, LineUnitLabel, StockType, StockTypeLabel } from "./schemas";

/** A product line as typed; `id` is blank until the line is saved. */
export type LineDraft = {
  id: string;
  product: string;
  stockType: StockType;
  supplier: string;
  qty: string;
  unit: LineUnit;
  areaM2: string;
};

type Row = LineDraft & { key: number };

export const blankLine = (): LineDraft => ({
  id: "",
  product: "Carpet Tile",
  stockType: "indent",
  supplier: "",
  qty: "",
  unit: "m2",
  areaM2: "",
});

const number = (text: string) => {
  const value = Number(text.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const measured = (row: LineDraft) => ({
  qty: number(row.qty),
  unit: row.unit,
  areaM2: number(row.areaM2),
});

/** What the line comes to in the other unit, so sqft and m² can both be read. */
function otherUnit(row: LineDraft): string {
  const qty = number(row.qty);
  if (row.unit === "m2") return `= ${formatQuantity(m2ToSqft(qty))} sqft`;
  if (row.unit === "sqft") return `= ${formatQuantity(sqftToM2(qty))} m²`;
  return `= ${formatQuantity(m2ToSqft(number(row.areaM2)))} sqft`;
}

/** Product lines of an MOF. Posts the rows as JSON in a hidden `lines` field. */
export function MofLinesEditor({
  initialLines,
  disabled,
}: {
  initialLines: LineDraft[];
  disabled: boolean;
}) {
  const nextKey = useRef(0);
  const withKey = (line: LineDraft): Row => {
    nextKey.current += 1;
    return { ...line, key: nextKey.current };
  };
  const [rows, setRows] = useState<Row[]>(() =>
    (initialLines.length > 0 ? initialLines : [blankLine()]).map(withKey),
  );

  const change = (key: number, patch: Partial<LineDraft>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const totalM2 = totalAreaM2(rows.map(measured));
  const posted = rows.map(({ key: _key, ...line }) => line);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="lines" value={JSON.stringify(posted)} />
      {rows.map((row, index) => {
        const keyedArea = row.unit === "roll" || row.unit === "pcs";
        const id = (field: string) => `line-${row.key}-${field}`;
        return (
          <div
            key={row.key}
            className="grid gap-3 rounded-lg border bg-sunk p-3 sm:grid-cols-6"
          >
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={id("product")}>Product</FieldLabel>
              <Input
                id={id("product")}
                value={row.product}
                onChange={(event) =>
                  change(row.key, { product: event.target.value })
                }
                placeholder="e.g. Carpet Tile"
                maxLength={100}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("stockType")}>Stock type</FieldLabel>
              <Select
                value={row.stockType}
                onValueChange={(value) =>
                  change(row.key, { stockType: StockType.parse(value) })
                }
              >
                <SelectTrigger id={id("stockType")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {StockType.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {StockTypeLabel[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={id("supplier")}>Supplier</FieldLabel>
              <Input
                id={id("supplier")}
                value={row.supplier}
                onChange={(event) =>
                  change(row.key, { supplier: event.target.value })
                }
                placeholder="e.g. Unijoy"
                maxLength={100}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("qty")}>Qty</FieldLabel>
              <Input
                id={id("qty")}
                value={row.qty}
                onChange={(event) =>
                  change(row.key, { qty: event.target.value })
                }
                inputMode="decimal"
                className="font-mono tabular-nums"
                placeholder="0"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("unit")}>Unit</FieldLabel>
              <Select
                value={row.unit}
                onValueChange={(value) =>
                  change(row.key, { unit: LineUnit.parse(value) })
                }
              >
                <SelectTrigger id={id("unit")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LineUnit.options.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {LineUnitLabel[unit]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-wrap items-end gap-3 sm:col-span-6">
              {keyedArea && (
                <Field className="w-40">
                  <FieldLabel htmlFor={id("areaM2")}>Area (m²)</FieldLabel>
                  <Input
                    id={id("areaM2")}
                    value={row.areaM2}
                    onChange={(event) =>
                      change(row.key, { areaM2: event.target.value })
                    }
                    inputMode="decimal"
                    className="font-mono tabular-nums"
                    placeholder="0"
                  />
                </Field>
              )}
              <p className="mr-auto pb-2 font-mono text-sm text-muted-foreground tabular-nums">
                {otherUnit(row)}
              </p>
              {rows.length > 1 && !disabled && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRows((current) =>
                      current.filter((other) => other.key !== row.key),
                    )
                  }
                  aria-label={`Remove line ${index + 1}`}
                >
                  <Trash2 data-icon="inline-start" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        {!disabled && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setRows((current) => [...current, withKey(blankLine())])
            }
          >
            <Plus data-icon="inline-start" />
            Add product line
          </Button>
        )}
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {rows.length} {rows.length === 1 ? "line" : "lines"} ·{" "}
          {formatQuantity(totalM2)} m² ({formatQuantity(m2ToSqft(totalM2))}{" "}
          sqft)
        </span>
      </div>
    </div>
  );
}
