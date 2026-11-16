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
  SAMPLE_PRODUCTS,
  SAMPLE_UNITS,
  type SampleUnit,
} from "@/lib/domain/samples";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { deleteSample, saveSample } from "./sample-actions";
import { describeMove } from "./sample-history";
import type { SampleRow } from "./samples-data";

type SampleDialogProps = {
  /** The sample to correct; none to add one. */
  sample?: SampleRow;
  /** Brands already in the list, offered while typing. */
  brands: readonly string[];
  /** Product group to start a new sample with, e.g. the one filtered on. */
  defaultProduct?: string;
  defaultBrand?: string;
  /** Names for the history; only a sample being corrected has one. */
  nameOf?: ReadonlyMap<string, string>;
};

/** Adds a sample at Best Link or corrects one. A changed quantity is written to its history. */
export function SampleDialog({
  sample,
  brands,
  defaultProduct,
  defaultBrand,
  nameOf = new Map(),
}: SampleDialogProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [product, setProduct] = useState(
    sample?.product ?? defaultProduct ?? SAMPLE_PRODUCTS[0],
  );
  const [unit, setUnit] = useState<SampleUnit>(sample?.unit ?? "pc");

  // A sample saved with a group that is not on the list keeps it.
  const products: readonly string[] = (
    SAMPLE_PRODUCTS as readonly string[]
  ).includes(product)
    ? SAMPLE_PRODUCTS
    : [product, ...SAMPLE_PRODUCTS];

  function save(formData: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await saveSample(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(sample ? t("Sample saved.") : t("Sample added."));
        if (!sample) form.reset();
        setOpen(false);
      }
    });
  }

  function remove() {
    if (!sample) return;
    startTransition(async () => {
      const result = await deleteSample(sample.id);
      setError(result.error);
      setAsking(false);
      if (!result.error) {
        toast.success(t("Sample deleted."));
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {sample ? (
          <Button size="sm" variant="ghost">
            {t("Edit")}
          </Button>
        ) : (
          <Button variant="outline">
            <Plus data-icon="inline-start" />
            {t("Add sample")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {sample
              ? `${t("Sample")} ${sample.sku || sample.name}`
              : t("Add sample at Best Link")}
          </DialogTitle>
          <DialogDescription>
            {t("One line per SKU, with how many we keep: 1 pc, 1 box...")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="sampleId" value={sample?.id ?? ""} />
          <input type="hidden" name="product" value={product} />
          <input type="hidden" name="unit" value={unit} />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="sampleProduct">{t("Product")}</FieldLabel>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger id="sampleProduct">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="sampleBrand">{t("Brand")}</FieldLabel>
                <Input
                  id="sampleBrand"
                  name="brand"
                  list="sampleBrands"
                  defaultValue={sample?.brand ?? defaultBrand}
                  maxLength={120}
                />
                <datalist id="sampleBrands">
                  {brands.map((brand) => (
                    <option key={brand} value={brand} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="sampleSku">{t("SKU")}</FieldLabel>
                <Input
                  id="sampleSku"
                  name="sku"
                  className="font-mono uppercase"
                  defaultValue={sample?.sku}
                  maxLength={60}
                  placeholder={t("e.g. XCH-03")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sampleName">
                  {t("Product name")}
                </FieldLabel>
                <Input
                  id="sampleName"
                  name="name"
                  defaultValue={sample?.name}
                  maxLength={200}
                  placeholder={t("e.g. Dawn to Dust")}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="sampleQty">
                  {t("Quantity at Best Link")}
                </FieldLabel>
                <Input
                  id="sampleQty"
                  name="qty"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="font-mono"
                  defaultValue={sample?.qty ?? 1}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sampleUnit">{t("Unit")}</FieldLabel>
                <Select
                  value={unit}
                  onValueChange={(value) => {
                    if (isOneOf(SAMPLE_UNITS, value)) setUnit(value);
                  }}
                >
                  <SelectTrigger id="sampleUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_UNITS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="sampleSpec">
                  {t("Size / specification")}
                </FieldLabel>
                <Input
                  id="sampleSpec"
                  name="spec"
                  defaultValue={sample?.spec}
                  maxLength={120}
                  placeholder={t("e.g. 25×100cm")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sampleNotes">{t("Notes")}</FieldLabel>
                <Input
                  id="sampleNotes"
                  name="notes"
                  defaultValue={sample?.notes}
                  maxLength={300}
                  placeholder={t("e.g. Rack B2 · 1 box = 20 pcs")}
                />
              </Field>
            </div>
            {sample && sample.moves.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm font-medium">
                  {t("History (")}
                  {sample.moves.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                  {sample.moves
                    .toReversed()
                    .map((move) => describeMove(move, sample.unit, nameOf))
                    .map(({ date, text }) => (
                      <li key={`${date}-${text}`}>
                        <span className="font-mono text-foreground">
                          {date}
                        </span>{" "}
                        · {text}
                      </li>
                    ))}
                </ul>
              </details>
            )}
            {error && <FieldError>{error}</FieldError>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? t("Saving...") : t("Save")}
              </Button>
              {sample &&
                (asking ? (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    {t("Delete it and its history?")}
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
