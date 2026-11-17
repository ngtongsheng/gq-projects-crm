import type { CalendarDate } from "@/lib/format/date";
import type {
  Currency,
  PaymentMethod,
  PrepaidCurrency,
  PrepaidKind,
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

/** One line of an event's cost sheet in full (table marketing_event_costs). */
export type EventCostLine = {
  id: string;
  costGroup: string;
  description: string | null;
  supplierRef: string | null;
  /** Free text such as "RMB 2700". */
  foreignAmount: string | null;
  rate: number;
  unit: string;
  qty: number;
  total: number;
  remarks: string | null;
};

/** An event with its own cost sheet (table marketing_events). */
export type MarketingEvent = {
  id: string;
  name: string;
  startsOn: CalendarDate | null;
  endsOn: CalendarDate | null;
  venue: string | null;
  budget: number | null;
  notes: string | null;
  costs: EventCostLine[];
};

/** One vendor's prepaid account, worked out by the database from its entries (view marketing_prepaid_balances). */
export type PrepaidAccount = {
  vendorId: string;
  vendorName: string;
  toppedUp: number;
  used: number;
  balance: number;
  /** Deductions taken from the account. */
  jobs: number;
  /** Of the used money, what is a marketing cost the client is not charged for. */
  marketingFoc: number;
  lastTopUpOn: CalendarDate | null;
  /** Warn when the balance falls below this; 0 is off. */
  lowBalanceAlert: number;
  low: boolean;
};

/** A top-up or a deducted job (table marketing_prepaid_entries). */
export type PrepaidEntry = {
  id: string;
  entryOn: CalendarDate;
  vendorId: string;
  vendorName: string;
  kind: PrepaidKind;
  /** A top-up's description, or the deduction's "Client - project". */
  description: string | null;
  foreignCurrency: PrepaidCurrency | null;
  foreignAmount: number | null;
  amountRm: number;
  mofRef: string | null;
  marketingFoc: boolean;
  remarks: string | null;
  /** Orders entries made on the same day. */
  createdAt: string;
};

/** One line of the sample and catalogue give-away register (table marketing_giveaways). */
export type Giveaway = {
  id: string;
  givenOn: CalendarDate;
  supplier: string | null;
  invoiceNo: string | null;
  item: string;
  givenTo: string;
  qty: number;
  unitCost: number;
  total: number;
};
