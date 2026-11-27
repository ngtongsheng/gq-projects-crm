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
import { textField } from "@/lib/form/form-fields";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { todayMyt } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { deleteGiveaway, saveGiveaway } from "./marketing-giveaway-actions";
import type { Giveaway } from "./marketing-types";

type MarketingGiveawayDialogProps = {
  /** The line being edited; leave out to add one. */
  giveaway?: Giveaway;
  /** Suppliers used before, offered while typing. */
  suppliers: readonly string[];
  /** Company names offered for who it was given to; the field stays free text. */
  customers: readonly string[];
  onClose: () => void;
};

/** Adds or edits a give-away line (demo sheetMkGive). Mounted while open. */
export function MarketingGiveawayDialog({
  giveaway,
  suppliers,
  customers,
  onClose,
}: MarketingGiveawayDialogProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveGiveaway({
        id: giveaway?.id ?? "",
        givenOn: textField(formData, "givenOn"),
        supplier: textField(formData, "supplier"),
        invoiceNo: textField(formData, "invoiceNo"),
        item: textField(formData, "item"),
        givenTo: textField(formData, "givenTo"),
        qty: textField(formData, "qty"),
        unitCost: textField(formData, "unitCost"),
      });
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Saved"));
      onClose();
    });
  }

  function remove() {
    if (!giveaway) return;
    startTransition(async () => {
      const result = await deleteGiveaway(giveaway.id);
      setError(result.error);
      setAsking(false);
      if (result.error !== null) return;
      toast.success(t("Give-away deleted."));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {giveaway ? t("Edit give-away") : t("Add give-away")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="giveawayDate">{t("Date")} *</FieldLabel>
                <Input
                  id="giveawayDate"
                  name="givenOn"
                  type="date"
                  defaultValue={giveaway?.givenOn ?? todayMyt()}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="giveawaySupplier">
                  {t("Supplier")}
                </FieldLabel>
                <Input
                  id="giveawaySupplier"
                  name="supplier"
                  list="giveawaySuppliers"
                  defaultValue={giveaway?.supplier ?? ""}
                  maxLength={200}
                />
                <datalist id="giveawaySuppliers">
                  {suppliers.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="giveawayItem">{t("Item")} *</FieldLabel>
                <Input
                  id="giveawayItem"
                  name="item"
                  defaultValue={giveaway?.item}
                  placeholder={t("e.g. Catalogue – Savoy")}
                  maxLength={300}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="giveawayInvoice">
                  {t("Invoice no.")}
                </FieldLabel>
                <Input
                  id="giveawayInvoice"
                  name="invoiceNo"
                  defaultValue={giveaway?.invoiceNo ?? ""}
                  maxLength={100}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="giveawayTo">
                {t("Given to (client / project)")} *
              </FieldLabel>
              <Input
                id="giveawayTo"
                name="givenTo"
                list="giveawayCustomers"
                defaultValue={giveaway?.givenTo}
                maxLength={200}
                required
              />
              <datalist id="giveawayCustomers">
                {customers.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="giveawayQty">{t("Qty")}</FieldLabel>
                <Input
                  id="giveawayQty"
                  name="qty"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  className="font-mono"
                  defaultValue={giveaway?.qty ?? 1}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="giveawayUnit">
                  {t("Unit cost (RM)")}
                </FieldLabel>
                <Input
                  id="giveawayUnit"
                  name="unitCost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="font-mono"
                  defaultValue={giveaway?.unitCost}
                />
              </Field>
            </div>
            {error && <FieldError>{t(error)}</FieldError>}
            <DeleteConfirm
              pending={pending}
              showDelete={giveaway !== undefined}
              question={t("Delete this give-away?")}
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
