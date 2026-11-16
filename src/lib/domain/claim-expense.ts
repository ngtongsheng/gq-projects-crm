import { z } from "zod";
import { fromCents, sumRm, toCents } from "@/lib/format/money";
import { CLAIM_EXPENSE_TYPES, type ClaimExpenseType } from "./monthly-claim";
import type { OutstationRules } from "./staff-package";

export const EXPENSE_TYPE_LABEL: Record<ClaimExpenseType, string> = {
  petrol: "Petrol",
  toll: "Toll",
  parking: "Parking",
  outstation_meals: "Outstation meals",
  hotel: "Hotel",
  mileage: "Mileage",
  grab: "Grab / taxi",
  others: "Others",
};

export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** Meals are a fixed allowance per meal (the HR outstation rules), no receipt. */
export const mealsAmount = (
  rules: Pick<OutstationRules, Meal>,
  meals: readonly Meal[],
): number => sumRm(meals.map((meal) => rules[meal]));

/** The meals are not stored on their own, so the checker reads them from the description. */
export const describeMeals = (
  description: string,
  meals: readonly Meal[],
): string =>
  meals.length === 0
    ? description
    : `${description} (${meals.map((meal) => MEAL_LABEL[meal]).join(", ")})`;

/** Meals are an allowance and mileage is km times a rate: neither has a receipt photo (D4). */
export const needsReceipt = (type: ClaimExpenseType): boolean =>
  type !== "outstation_meals" && type !== "mileage";

const MAX_AMOUNT = 100_000;

/** What the person keys in; blank fields arrive as null. Mirrors the line checks in the claims migration. */
const ExpenseFields = z.object({
  spentOn: z.iso.date("Choose the date."),
  expenseType: z.enum(CLAIM_EXPENSE_TYPES, "Choose the type."),
  description: z
    .string()
    .trim()
    .min(1, "Write where or what.")
    .max(300, "Keep it under 300 characters."),
  amount: z.number().nullable(),
  km: z.number().nullable(),
  nights: z.number().nullable(),
});

export const ExpenseInput = ExpenseFields.transform((fields, context) => {
  const { expenseType } = fields;
  const issue = (message: string, path: string) => {
    context.addIssue({ code: "custom", message, path: [path] });
    return z.NEVER;
  };

  if (expenseType === "mileage") {
    if (fields.km === null || !(fields.km > 0) || fields.km > 9999) {
      return issue("Key in the km driven.", "km");
    }
    // The database works out the amount from the km and the mileage rate.
    return {
      ...fields,
      km: Math.round(fields.km * 10) / 10,
      nights: null,
      amount: null,
    };
  }
  if (fields.amount === null || !(fields.amount > 0)) {
    return issue("Key in the amount.", "amount");
  }
  if (fields.amount > MAX_AMOUNT) {
    return issue("That amount is too large. Check it.", "amount");
  }
  const amount = fromCents(toCents(fields.amount));
  if (expenseType === "hotel") {
    if (
      fields.nights === null ||
      !Number.isInteger(fields.nights) ||
      fields.nights < 1 ||
      fields.nights > 60
    ) {
      return issue("Key in the number of nights.", "nights");
    }
    return { ...fields, amount, km: null, nights: fields.nights };
  }
  return { ...fields, amount, km: null, nights: null };
});
export type ExpenseInput = z.output<typeof ExpenseInput>;
