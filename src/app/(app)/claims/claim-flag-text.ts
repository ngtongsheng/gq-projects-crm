import type { ExpenseFlag, MonthlyFlag } from "@/lib/domain/monthly-claim";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";

/** The warning for one expense line, from the typed flag (D5). It warns the checker; it never blocks. */
export function expenseFlagText(flag: ExpenseFlag, t: Translate): string {
  switch (flag.kind) {
    case "no_visit":
      return t("Nothing logged in the calendar or site log this day");
    case "hotel_over_budget":
      return `${t("Hotel")} ${formatRm(flag.perNight)} ${t("a night is over the budget of")} ${formatRm(flag.budget)}`;
    case "meals_twice":
      return t("Meals claimed twice this day");
    case "km_over_day":
      return `${flag.km} km ${t("this day is over the standard of")} ${flag.kmPerDay} km`;
  }
}

/** The warning for the whole month's travel. */
export function monthlyFlagText(flag: MonthlyFlag, t: Translate): string {
  switch (flag.kind) {
    case "monthly_cap":
      return `${t("Petrol, toll and parking")} ${formatRm(flag.used)} ${t("is over the monthly cap of")} ${formatRm(flag.cap)} ${t("by")} ${formatRm(flag.over)}. ${t("It needs the MD's approval.")}`;
    case "travel_limit":
      return `${t("Travel total")} ${formatRm(flag.total)} ${t("is over the monthly limit of")} ${formatRm(flag.limit)} ${t("by")} ${formatRm(flag.over)}`;
  }
}
