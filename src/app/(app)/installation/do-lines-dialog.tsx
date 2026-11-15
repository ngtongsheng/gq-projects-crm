"use client";

import { ListPlus, Plus, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
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
import { FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type DeliveredEarlier,
  DO_PRODUCTS,
  DO_UNITS,
  type DoLine,
  deliveredEarlierText,
  lineFromMofProduct,
} from "@/lib/domain/delivery-order";
import { saveDoLines } from "./do-actions";

type Row = {
  key: number;
  product: string;
  code: string;
  description: string;
  qty: string;
  unit: string;
  covers: string;
  batch: string;
};

export type OrderedProduct = { product: string; qty: number; unit: string };

type DoLinesDialogProps = {
  mofId: string;
  mofNo: string;
  jobId: string;
  lines: DoLine[];
  /** What the MOF ordered, for the reminder and "Copy products from the MOF". */
  ordered: OrderedProduct[];
  earlier: DeliveredEarlier[];
};

/** The items on a delivery's DO: product, code, description, quantity, unit, what it covers, batch. */
export function DoLinesDialog(props: DoLinesDialogProps) {
  const [open, setOpen] = useState(false);
  const count = props.lines.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ListPlus data-icon="inline-start" />
          DO items{count > 0 && ` (${count})`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Items on this DO</DialogTitle>
          <DialogDescription>
            Needed to print the DO. Any unit: boxes, pcs, rolls, m²...
          </DialogDescription>
        </DialogHeader>
        <LinesForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function LinesForm({
  mofId,
  mofNo,
  jobId,
  lines,
  ordered,
  earlier,
  onSaved,
}: DoLinesDialogProps & { onSaved: () => void }) {
  const nextKey = useRef(0);
  const blank = (): Row => ({
    key: nextKey.current++,
    product: DO_PRODUCTS[0],
    code: "",
    description: "",
    qty: "",
    unit: "Box",
    covers: "",
    batch: "",
  });
  const [rows, setRows] = useState<Row[]>(() =>
    lines.length > 0
      ? lines.map((line) => ({
          key: nextKey.current++,
          product: line.product,
          code: line.code ?? "",
          description: line.description ?? "",
          qty: String(line.qty),
          unit: line.unit,
          covers: line.covers ?? "",
          batch: line.batch ?? "",
        }))
      : [blank()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (key: number, fields: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...fields } : row)),
    );

  function copyFromMof() {
    setRows((current) => [
      ...current,
      ...ordered.map((item) => ({
        ...blank(),
        ...lineFromMofProduct(item.product, item.unit),
      })),
    ]);
  }

  function save() {
    startTransition(async () => {
      const result = await saveDoLines(
        mofId,
        jobId,
        rows.map(({ key: _key, qty, ...row }) => ({
          ...row,
          qty: qty.trim() === "" ? 0 : Number(qty),
        })),
      );
      setError(result.error);
      if (!result.error) {
        toast.success("DO items saved.");
        onSaved();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-12"
        >
          <div className="sm:col-span-2">
            <FieldLabel className="text-xs">Product</FieldLabel>
            <Select
              value={row.product}
              onValueChange={(product) => change(row.key, { product })}
            >
              <SelectTrigger aria-label="Product">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(DO_PRODUCTS as readonly string[]).includes(row.product) ? (
                  DO_PRODUCTS.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={row.product}>{row.product}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel className="text-xs">Item code</FieldLabel>
            <Input
              value={row.code}
              onChange={(event) =>
                change(row.key, { code: event.target.value })
              }
              placeholder="e.g. CSC-01"
              maxLength={40}
            />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <FieldLabel className="text-xs">Description</FieldLabel>
            <Input
              value={row.description}
              onChange={(event) =>
                change(row.key, { description: event.target.value })
              }
              placeholder="e.g. Grey 50x50"
              maxLength={200}
            />
          </div>
          <div className="sm:col-span-1">
            <FieldLabel className="text-xs">Qty</FieldLabel>
            <Input
              type="number"
              min="0"
              step="any"
              className="font-mono"
              value={row.qty}
              onChange={(event) => change(row.key, { qty: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel className="text-xs">Unit</FieldLabel>
            <Select
              value={row.unit}
              onValueChange={(unit) => change(row.key, { unit })}
            >
              <SelectTrigger aria-label="Unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DO_UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex items-end justify-end sm:col-span-2">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Remove line"
              onClick={() =>
                setRows((current) =>
                  current.filter((other) => other.key !== row.key),
                )
              }
            >
              <X />
            </Button>
          </div>
          <div className="col-span-2 sm:col-span-6">
            <FieldLabel className="text-xs">Covers (optional)</FieldLabel>
            <Input
              value={row.covers}
              onChange={(event) =>
                change(row.key, { covers: event.target.value })
              }
              placeholder="e.g. 1550 sqft"
              maxLength={60}
            />
          </div>
          <div className="col-span-2 sm:col-span-6">
            <FieldLabel className="text-xs">Batch / lot (optional)</FieldLabel>
            <Input
              value={row.batch}
              onChange={(event) =>
                change(row.key, { batch: event.target.value })
              }
              maxLength={60}
            />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setRows((current) => [...current, blank()])}
        >
          <Plus data-icon="inline-start" />
          Add line
        </Button>
        {ordered.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={copyFromMof}>
            Copy products from the MOF
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {mofNo} ordered:{" "}
        {ordered.length > 0
          ? ordered
              .map((item) => `${item.product} ${item.qty} ${item.unit}`)
              .join(" · ")
          : "no products"}
        {earlier.length > 0 && (
          <>
            <br />
            Delivered on earlier DOs: {deliveredEarlierText(earlier)}
          </>
        )}
      </p>
      {error && <FieldError>{error}</FieldError>}
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save items"}
      </Button>
    </div>
  );
}
