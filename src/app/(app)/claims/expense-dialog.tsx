"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPENSE_TYPE_LABEL,
  MEAL_LABEL,
  MEALS,
  type Meal,
  mealsAmount,
  needsReceipt,
} from "@/lib/domain/claim-expense";
import {
  CLAIM_EXPENSE_TYPES,
  type ClaimExpenseType,
  claimMonthOf,
  mileageAmount,
} from "@/lib/domain/monthly-claim";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatMonth } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { prepareAttachment } from "@/lib/storage/downscale";
import { addExpense, updateExpense } from "./expense-actions";
import { uploadReceipt } from "./receipt-upload";

/** What the dialog needs to know about the person's claim rules. */
export type ExpenseRules = {
  /** Malaysia date, so the default and the limit match the server. */
  today: string;
  cutOffDay: number;
  mileageRatePerKm: number;
  /** The HR meal allowances; null when they could not be read, so the amount is keyed in. */
  meals: Record<Meal, number> | null;
  /** The person's hotel budget per night, when known. */
  hotelBudget: number | null;
};

export type EditableExpense = {
  id: string;
  spentOn: string;
  expenseType: ClaimExpenseType;
  description: string;
  km: number | null;
  nights: number | null;
  amount: number;
};

/** Adds a travelling expense with its receipt photo, or (with `expense`) changes one. */
export function ExpenseDialog({
  rules,
  expense,
}: {
  rules: ExpenseRules;
  expense?: EditableExpense;
}) {
  const editing = expense !== undefined;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? rules.today);
  const [expenseType, setExpenseType] = useState<ClaimExpenseType>(
    expense?.expenseType ?? "petrol",
  );
  const [meals, setMeals] = useState<Meal[]>([]);
  const [km, setKm] = useState(expense?.km?.toString() ?? "");
  const [amount, setAmount] = useState(expense?.amount.toString() ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptKey, setReceiptKey] = useState(0);
  const t = useT();

  const isMeals = expenseType === "outstation_meals";
  // Ticking meals fills in the allowance; without the HR rules the person keys it in.
  const mealsFilled = isMeals && !editing && rules.meals !== null;
  const shownAmount =
    mealsFilled && rules.meals
      ? String(mealsAmount(rules.meals, meals))
      : amount;
  const goesInto = /^\d{4}-\d{2}-\d{2}$/.test(spentOn)
    ? formatMonth(claimMonthOf(spentOn, rules.cutOffDay))
    : null;
  const kmNumber = Number(km);

  function toggleMeal(meal: Meal, on: boolean) {
    setMeals((current) =>
      on ? [...current, meal] : current.filter((item) => item !== meal),
    );
  }

  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    // Reading a photo the browser cannot decode rejects; treat it like any other bad file.
    const prepared = await prepareAttachment(file).catch(() => ({
      ok: false as const,
      error: t("That photo could not be read. Try another."),
    }));
    if (prepared.ok) {
      setReceipt(prepared.file);
      setError(null);
    } else {
      setReceipt(null);
      setReceiptKey((key) => key + 1);
      setError(prepared.error);
    }
  }

  function reset() {
    setSpentOn(rules.today);
    setExpenseType("petrol");
    setMeals([]);
    setKm("");
    setAmount("");
    setReceipt(null);
    setReceiptKey((key) => key + 1);
  }

  function save(formData: FormData, form: HTMLFormElement) {
    if (!editing && needsReceipt(expenseType) && !receipt) {
      setError(t("Take a photo of the receipt."));
      return;
    }
    startTransition(async () => {
      if (editing) {
        const result = await updateExpense(expense.id, formData);
        setError(result.error);
        if (result.error !== null) return;
        toast.success(t("Expense changed."));
        setOpen(false);
        return;
      }

      const result = await addExpense(formData);
      setError(result.error);
      if (result.error !== null) return;
      if (receipt) {
        const sent = await uploadReceipt(result.expenseId, receipt);
        if (!sent.ok) {
          toast.error(
            `${t("Expense added, but the receipt was not uploaded:")} ${sent.error} ${t("Add it from the list.")}`,
          );
        } else {
          toast.success(
            `${t("Added to the")} ${result.monthLabel} ${t("claim.")}`,
          );
        }
      } else {
        toast.success(
          `${t("Added to the")} ${result.monthLabel} ${t("claim.")}`,
        );
      }
      form.reset();
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button type="button" variant="ghost" size="sm">
            <Pencil data-icon="inline-start" />
            {t("Edit")}
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            {t("Add expense")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("Change travelling expense")
              : t("Add travelling expense")}
          </DialogTitle>
          <DialogDescription>
            {goesInto
              ? `${t("This goes into the")} ${goesInto} ${t("claim.")} ${t("Dates after day")} ${rules.cutOffDay} ${t("of the month go into the next month's claim.")}`
              : t("Choose the date.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="expenseType" value={expenseType} />
          {mealsFilled &&
            meals.map((meal) => (
              <input key={meal} type="hidden" name="meals" value={meal} />
            ))}
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="expenseDate">{t("Date")}</FieldLabel>
                <Input
                  id="expenseDate"
                  name="spentOn"
                  type="date"
                  value={spentOn}
                  max={rules.today}
                  onChange={(event) => setSpentOn(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="expenseType">{t("Type")}</FieldLabel>
                <Select
                  value={expenseType}
                  onValueChange={(value) =>
                    setExpenseType(
                      CLAIM_EXPENSE_TYPES.find((type) => type === value) ??
                        "petrol",
                    )
                  }
                >
                  <SelectTrigger id="expenseType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAIM_EXPENSE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(EXPENSE_TYPE_LABEL[type])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="expenseWhat">{t("Where / what")}</FieldLabel>
              <Input
                id="expenseWhat"
                name="description"
                maxLength={300}
                defaultValue={expense?.description}
                placeholder={t(
                  "e.g. Office to SLA Architects, Bangsar, then site P1600",
                )}
                required
              />
            </Field>
            {mealsFilled && rules.meals && (
              <Field>
                <FieldLabel>{t("Meals")}</FieldLabel>
                <div className="flex flex-wrap gap-4">
                  {MEALS.map((meal) => (
                    <div key={meal} className="flex items-center gap-2">
                      <Checkbox
                        id={`meal-${meal}`}
                        checked={meals.includes(meal)}
                        onCheckedChange={(checked) =>
                          toggleMeal(meal, checked === true)
                        }
                      />
                      <Label htmlFor={`meal-${meal}`} className="font-normal">
                        {t(MEAL_LABEL[meal])}{" "}
                        {formatRm(rules.meals?.[meal] ?? 0)}
                      </Label>
                    </div>
                  ))}
                </div>
              </Field>
            )}
            {expenseType === "hotel" && (
              <Field>
                <FieldLabel htmlFor="expenseNights">{t("Nights")}</FieldLabel>
                <Input
                  id="expenseNights"
                  name="nights"
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  inputMode="numeric"
                  defaultValue={expense?.nights ?? 1}
                  required
                />
                {rules.hotelBudget !== null && (
                  <FieldDescription>
                    {t("Your budget is up to")} {formatRm(rules.hotelBudget)}{" "}
                    {t("a night.")}
                  </FieldDescription>
                )}
              </Field>
            )}
            {expenseType === "mileage" ? (
              <Field>
                <FieldLabel htmlFor="expenseKm">{t("Km driven")}</FieldLabel>
                <Input
                  id="expenseKm"
                  name="km"
                  type="number"
                  min={0.1}
                  step={0.1}
                  inputMode="decimal"
                  value={km}
                  onChange={(event) => setKm(event.target.value)}
                  required
                />
                <FieldDescription>
                  {`${formatRm(rules.mileageRatePerKm)} ${t("per km")}`}
                  {kmNumber > 0
                    ? ` · ${formatRm(mileageAmount(kmNumber, rules.mileageRatePerKm))}`
                    : ""}
                </FieldDescription>
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="expenseAmount">
                  {t("Amount (RM)")}
                </FieldLabel>
                <Input
                  id="expenseAmount"
                  name="amount"
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  value={shownAmount}
                  readOnly={mealsFilled}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </Field>
            )}
            {!editing && needsReceipt(expenseType) && (
              <Field>
                <FieldLabel htmlFor="expenseReceipt">
                  {t("Receipt photo")}
                </FieldLabel>
                <Input
                  key={receiptKey}
                  id="expenseReceipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    void pickReceipt(event.target.files?.[0])
                  }
                />
                <FieldDescription>
                  {receipt
                    ? `${receipt.name} ${t("attached")}`
                    : t("Photo, up to 1.5 MB")}
                </FieldDescription>
              </Field>
            )}
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : editing ? t("Save") : t("Add")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
