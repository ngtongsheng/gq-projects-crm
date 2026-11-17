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
import { Textarea } from "@/components/ui/textarea";
import { textField } from "@/lib/form/form-fields";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { todayMyt } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import {
  deleteMarketingExpense,
  saveMarketingExpense,
} from "./marketing-expense-actions";
import {
  CURRENCIES,
  CURRENCY_LABEL,
  type Currency,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "./marketing-options";
import type {
  MarketingCategory,
  MarketingEventOption,
  MarketingExpense,
} from "./marketing-types";

const NO_EVENT = "none";

type MarketingExpenseDialogProps = {
  /** The expense being edited; leave out to add one. */
  expense?: MarketingExpense;
  categories: readonly MarketingCategory[];
  events: readonly MarketingEventOption[];
  vendors: readonly string[];
  onClose: () => void;
};

/** Adds or edits one expense (demo sheetMkExp). Mounted while open, so each opening starts from the expense. */
export function MarketingExpenseDialog({
  expense,
  categories,
  events,
  vendors,
  onClose,
}: MarketingExpenseDialogProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? categories[0]?.id ?? "",
  );
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? "RM");
  const [eventId, setEventId] = useState(expense?.eventId ?? NO_EVENT);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    expense?.paymentMethod ?? "bank_transfer",
  );

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveMarketingExpense({
        id: expense?.id ?? "",
        spentOn: textField(formData, "spentOn"),
        categoryId,
        description: textField(formData, "description"),
        vendor: textField(formData, "vendor"),
        invoiceRef: textField(formData, "invoiceRef"),
        currency,
        amount: textField(formData, "amount"),
        amountRm: textField(formData, "amountRm"),
        eventId: eventId === NO_EVENT ? "" : eventId,
        paymentMethod,
        remarks: textField(formData, "remarks"),
      });
      setError(result.error);
      if (result.error !== null) return;
      toast.success(expense ? t("Saved") : t("Expense added"));
      onClose();
    });
  }

  function remove() {
    if (!expense) return;
    startTransition(async () => {
      const result = await deleteMarketingExpense(expense.id);
      setError(result.error);
      setAsking(false);
      if (result.error !== null) return;
      toast.success(t("Expense deleted."));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {expense ? t("Edit expense") : t("Add expense")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "A vendor you have not used before is added to the vendor list.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="expenseDate">{t("Date")} *</FieldLabel>
                <Input
                  id="expenseDate"
                  name="spentOn"
                  type="date"
                  defaultValue={expense?.spentOn ?? todayMyt()}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="expenseCategory">
                  {t("Category")} *
                </FieldLabel>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="expenseCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="expenseDescription">
                {t("Description")} *
              </FieldLabel>
              <Input
                id="expenseDescription"
                name="description"
                defaultValue={expense?.description}
                maxLength={300}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="expenseVendor">{t("Vendor")} *</FieldLabel>
                <Input
                  id="expenseVendor"
                  name="vendor"
                  list="expenseVendors"
                  defaultValue={expense?.vendorName}
                  maxLength={200}
                  required
                />
                <datalist id="expenseVendors">
                  {vendors.map((vendor) => (
                    <option key={vendor} value={vendor} />
                  ))}
                </datalist>
              </Field>
              <Field>
                <FieldLabel htmlFor="expenseInvoice">
                  {t("Invoice / ref no.")}
                </FieldLabel>
                <Input
                  id="expenseInvoice"
                  name="invoiceRef"
                  defaultValue={expense?.invoiceRef ?? ""}
                  maxLength={100}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="expenseCurrency">
                  {t("Currency")}
                </FieldLabel>
                <Select
                  value={currency}
                  onValueChange={(value) => {
                    if (isOneOf(CURRENCIES, value)) setCurrency(value);
                  }}
                >
                  <SelectTrigger id="expenseCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(CURRENCY_LABEL[value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="expenseAmount">{t("Amount")} *</FieldLabel>
                <Input
                  id="expenseAmount"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="font-mono"
                  defaultValue={expense?.amount}
                  required
                />
              </Field>
            </div>
            {currency !== "RM" && (
              <Field>
                <FieldLabel htmlFor="expenseAmountRm">
                  {t("Amount in RM")} *
                </FieldLabel>
                <Input
                  id="expenseAmountRm"
                  name="amountRm"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="font-mono"
                  defaultValue={
                    expense && expense.currency !== "RM"
                      ? expense.amountRm
                      : undefined
                  }
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="expenseEvent">{t("Event")}</FieldLabel>
                <Select value={eventId} onValueChange={setEventId}>
                  <SelectTrigger id="expenseEvent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_EVENT}>
                      {t("— Not for an event —")}
                    </SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="expensePayment">
                  {t("Payment method")}
                </FieldLabel>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => {
                    if (isOneOf(PAYMENT_METHODS, value))
                      setPaymentMethod(value);
                  }}
                >
                  <SelectTrigger id="expensePayment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(PAYMENT_METHOD_LABEL[value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="expenseRemarks">{t("Remarks")}</FieldLabel>
              <Textarea
                id="expenseRemarks"
                name="remarks"
                rows={2}
                defaultValue={expense?.remarks ?? ""}
                maxLength={1000}
              />
            </Field>
            {error && <FieldError>{t(error)}</FieldError>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? t("Saving...") : t("Save")}
              </Button>
              {expense &&
                (asking ? (
                  <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                    {t("Delete this expense?")}
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
