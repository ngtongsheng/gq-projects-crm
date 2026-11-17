import type { CalendarDate } from "@/lib/format/date";
import type { Currency, PaymentMethod } from "./marketing-options";

/** An expense category with the number of expenses using it (table marketing_categories). */
export type MarketingCategory = {
  id: string;
  name: string;
  used: number;
};

/** One line of the expense log (table marketing_expenses). */
export type MarketingExpense = {
  id: string;
  spentOn: CalendarDate;
  categoryId: string;
  description: string;
  vendorName: string;
  invoiceRef: string | null;
  currency: Currency;
  amount: number;
  amountRm: number;
  eventId: string | null;
  eventName: string | null;
  paymentMethod: PaymentMethod;
  remarks: string | null;
  /** Orders lines spent on the same day, newest first. */
  createdAt: string;
};

export type MarketingEventOption = { id: string; name: string };

/** One line of an event's own cost sheet, with the event it belongs to (table marketing_event_costs). */
export type MarketingEventCost = {
  eventId: string;
  eventName: string;
  total: number;
};
