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
  STOCK_UNIT_LABEL,
  STOCK_UNITS,
  type StockUnit,
} from "@/lib/domain/reservation";
import { isOneOf } from "@/lib/form/one-of";
import { saveStockItem } from "./actions";
import type { StockItem } from "./stock-data";

/** Adds a stock item, or corrects one. Quantity is what is on hand; holds are taken off it. */
export function StockItemDialog({ item }: { item?: StockItem }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<StockUnit>(item?.unit ?? "box");

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveStockItem(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(item ? "Stock item updated." : "Stock item added.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button size="sm" variant="outline">
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            Add stock item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? item.sku : "Add a stock item"}</DialogTitle>
          <DialogDescription>
            One line per SKU. Quantity is what is on hand.
          </DialogDescription>
        </DialogHeader>
        <form action={save}>
          <input type="hidden" name="itemId" value={item?.id ?? ""} />
          <input type="hidden" name="unit" value={unit} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="stockSku">SKU</FieldLabel>
              <Input
                id="stockSku"
                name="sku"
                defaultValue={item?.sku}
                maxLength={60}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="stockSupplier">Supplier</FieldLabel>
              <Input
                id="stockSupplier"
                name="supplier"
                defaultValue={item?.supplier}
                maxLength={120}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="stockCollection">Collection</FieldLabel>
              <Input
                id="stockCollection"
                name="collection"
                defaultValue={item?.collection}
                maxLength={120}
                placeholder="e.g. Forge"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="stockQty">Quantity</FieldLabel>
                <Input
                  id="stockQty"
                  name="qty"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  defaultValue={item?.qty}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="stockUnit">Unit</FieldLabel>
                <Select
                  value={unit}
                  onValueChange={(value) => {
                    if (isOneOf(STOCK_UNITS, value)) setUnit(value);
                  }}
                  disabled={Boolean(item)}
                >
                  <SelectTrigger id="stockUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_UNITS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {STOCK_UNIT_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {item && <FieldDescription>Fixed once added.</FieldDescription>}
              </Field>
            </div>
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
