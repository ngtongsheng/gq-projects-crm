import type { CalendarDate } from "@/lib/format/date";
import type {
  Currency,
  PaymentMethod,
  VendorKind,
  VendorSkill,
  VendorSupply,
} from "./marketing-options";

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

/** A company or part-timer paid through the expense log (table marketing_vendors), with what was paid to them. */
export type MarketingVendor = {
  id: string;
  kind: VendorKind;
  name: string;
  supplies: VendorSupply | null;
  contactPerson: string | null;
  skills: VendorSkill[];
  rate: string | null;
  portfolioUrl: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  /** Every expense line paid to this vendor, for the year total and the last-paid date. */
  payments: { spentOn: CalendarDate; amountRm: number }[];
  /** How many prepaid-account entries use this vendor; the database blocks a delete while any exist. */
  prepaidEntries: number;
};
