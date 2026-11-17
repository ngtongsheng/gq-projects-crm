import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  CURRENCIES,
  PAYMENT_METHODS,
  VENDOR_KINDS,
  VENDOR_SKILLS,
  VENDOR_SUPPLIES,
} from "./marketing-options";
import type {
  MarketingCategory,
  MarketingEventCost,
  MarketingEventOption,
  MarketingExpense,
  MarketingVendor,
} from "./marketing-types";

const categoryRows = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    marketing_expenses: z.array(z.object({ count: z.number() })),
  }),
);

/** The categories in dashboard order, each with how many expenses use it. */
export async function loadMarketingCategories(): Promise<MarketingCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_categories")
    .select("id, name, marketing_expenses(count)")
    .order("sort_order");
  if (error) {
    throw new Error(`Could not load marketing categories: ${error.message}`);
  }
  return categoryRows.parse(data).map((row) => ({
    id: row.id,
    name: row.name,
    used: row.marketing_expenses[0]?.count ?? 0,
  }));
}

/** Vendor names offered while typing an expense's vendor. */
export async function loadVendorNames(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_vendors")
    .select("name")
    .order("name");
  if (error) {
    throw new Error(`Could not load marketing vendors: ${error.message}`);
  }
  return z
    .array(z.object({ name: z.string() }))
    .parse(data)
    .map((row) => row.name);
}

/** Events an expense can be tagged to, newest first. */
export async function loadEventOptions(): Promise<MarketingEventOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_events")
    .select("id, name")
    .order("starts_on", { ascending: false, nullsFirst: false })
    .order("name");
  if (error) {
    throw new Error(`Could not load marketing events: ${error.message}`);
  }
  return z.array(z.object({ id: z.uuid(), name: z.string() })).parse(data);
}

const expenseRows = z.array(
  z.object({
    id: z.uuid(),
    spent_on: z.iso.date(),
    category_id: z.uuid(),
    description: z.string(),
    invoice_ref: z.string().nullable(),
    currency: z.enum(CURRENCIES),
    amount: z.number(),
    amount_rm: z.number(),
    event_id: z.uuid().nullable(),
    payment_method: z.enum(PAYMENT_METHODS),
    remarks: z.string().nullable(),
    created_at: z.string(),
    marketing_vendors: z.object({ name: z.string() }),
    marketing_events: z.object({ name: z.string() }).nullable(),
  }),
);

/** Every expense in the log. Filtering and the year view happen in the browser. */
export async function loadMarketingExpenses(): Promise<MarketingExpense[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_expenses")
    .select(
      "id, spent_on, category_id, description, invoice_ref, currency, amount, amount_rm, event_id, payment_method, remarks, created_at, marketing_vendors(name), marketing_events(name)",
    );
  if (error) {
    throw new Error(`Could not load marketing expenses: ${error.message}`);
  }
  return expenseRows.parse(data).map((row) => ({
    id: row.id,
    spentOn: row.spent_on,
    categoryId: row.category_id,
    description: row.description,
    vendorName: row.marketing_vendors.name,
    invoiceRef: row.invoice_ref,
    currency: row.currency,
    amount: row.amount,
    amountRm: row.amount_rm,
    eventId: row.event_id,
    eventName: row.marketing_events?.name ?? null,
    paymentMethod: row.payment_method,
    remarks: row.remarks,
    createdAt: row.created_at,
  }));
}

const eventCostQueryRows = z.array(
  z.object({
    event_id: z.uuid(),
    total: z.number(),
    marketing_events: z.object({ name: z.string() }),
  }),
);

/** The lines of every event's cost sheet, for the dashboard's events panel. */
export async function loadEventCosts(): Promise<MarketingEventCost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_event_costs")
    .select("event_id, total, marketing_events(name)");
  if (error) {
    throw new Error(`Could not load event costs: ${error.message}`);
  }
  return eventCostQueryRows.parse(data).map((row) => ({
    eventId: row.event_id,
    eventName: row.marketing_events.name,
    total: row.total,
  }));
}

const vendorQueryRows = z.array(
  z.object({
    id: z.uuid(),
    kind: z.enum(VENDOR_KINDS),
    name: z.string(),
    supplies: z.enum(VENDOR_SUPPLIES).nullable(),
    contact_person: z.string().nullable(),
    skills: z.array(z.enum(VENDOR_SKILLS)),
    rate: z.string().nullable(),
    portfolio_url: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    notes: z.string().nullable(),
    marketing_expenses: z.array(
      z.object({ spent_on: z.iso.date(), amount_rm: z.number() }),
    ),
    marketing_prepaid_entries: z.array(z.object({ count: z.number() })),
  }),
);

/** Every vendor with what was paid to them; the year totals are worked out in the browser. */
export async function loadMarketingVendors(): Promise<MarketingVendor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_vendors")
    .select(
      "id, kind, name, supplies, contact_person, skills, rate, portfolio_url, phone, email, notes, marketing_expenses(spent_on, amount_rm), marketing_prepaid_entries(count)",
    );
  if (error) {
    throw new Error(`Could not load marketing vendors: ${error.message}`);
  }
  return vendorQueryRows.parse(data).map((row) => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    supplies: row.supplies,
    contactPerson: row.contact_person,
    skills: row.skills,
    rate: row.rate,
    portfolioUrl: row.portfolio_url,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    payments: row.marketing_expenses.map((payment) => ({
      spentOn: payment.spent_on,
      amountRm: payment.amount_rm,
    })),
    prepaidEntries: row.marketing_prepaid_entries[0]?.count ?? 0,
  }));
}
