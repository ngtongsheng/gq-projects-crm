import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PREPAID_CURRENCIES, PREPAID_KINDS } from "./marketing-options";
import type { PrepaidAccount, PrepaidEntry } from "./marketing-types";

const balanceRows = z.array(
  z.object({
    vendor_id: z.uuid(),
    topped_up: z.number(),
    used: z.number(),
    balance: z.number(),
    jobs: z.number(),
    marketing_foc: z.number(),
    last_top_up_on: z.iso.date().nullable(),
    low_balance_alert: z.number(),
    low: z.boolean(),
  }),
);

const vendorNames = z.array(z.object({ id: z.uuid(), name: z.string() }));

/** Every vendor with prepaid entries and its balance, worked out by the database; A to Z. */
export async function loadPrepaidAccounts(): Promise<PrepaidAccount[]> {
  const supabase = await createClient();
  const [balances, vendors] = await Promise.all([
    supabase
      .from("marketing_prepaid_balances")
      .select(
        "vendor_id, topped_up, used, balance, jobs, marketing_foc, last_top_up_on, low_balance_alert, low",
      ),
    supabase.from("marketing_vendors").select("id, name"),
  ]);
  if (balances.error) {
    throw new Error(
      `Could not load prepaid balances: ${balances.error.message}`,
    );
  }
  if (vendors.error) {
    throw new Error(
      `Could not load marketing vendors: ${vendors.error.message}`,
    );
  }
  const names = new Map(
    vendorNames.parse(vendors.data).map((vendor) => [vendor.id, vendor.name]),
  );
  return balanceRows
    .parse(balances.data)
    .flatMap((row) => {
      const vendorName = names.get(row.vendor_id);
      return vendorName === undefined
        ? []
        : [
            {
              vendorId: row.vendor_id,
              vendorName,
              toppedUp: row.topped_up,
              used: row.used,
              balance: row.balance,
              jobs: row.jobs,
              marketingFoc: row.marketing_foc,
              lastTopUpOn: row.last_top_up_on,
              lowBalanceAlert: row.low_balance_alert,
              low: row.low,
            },
          ];
    })
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}

const entryRows = z.array(
  z.object({
    id: z.uuid(),
    entry_on: z.iso.date(),
    vendor_id: z.uuid(),
    kind: z.enum(PREPAID_KINDS),
    description: z.string().nullable(),
    foreign_currency: z.enum(PREPAID_CURRENCIES).nullable(),
    foreign_amount: z.number().nullable(),
    amount_rm: z.number(),
    mof_ref: z.string().nullable(),
    marketing_foc: z.boolean(),
    remarks: z.string().nullable(),
    created_at: z.string(),
    marketing_vendors: z.object({ name: z.string() }),
  }),
);

/** Every top-up and deduction. Ordering and running balances happen in the browser. */
export async function loadPrepaidEntries(): Promise<PrepaidEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_prepaid_entries")
    .select(
      "id, entry_on, vendor_id, kind, description, foreign_currency, foreign_amount, amount_rm, mof_ref, marketing_foc, remarks, created_at, marketing_vendors(name)",
    );
  if (error) {
    throw new Error(`Could not load prepaid entries: ${error.message}`);
  }
  return entryRows.parse(data).map((row) => ({
    id: row.id,
    entryOn: row.entry_on,
    vendorId: row.vendor_id,
    vendorName: row.marketing_vendors.name,
    kind: row.kind,
    description: row.description,
    foreignCurrency: row.foreign_currency,
    foreignAmount: row.foreign_amount,
    amountRm: row.amount_rm,
    mofRef: row.mof_ref,
    marketingFoc: row.marketing_foc,
    remarks: row.remarks,
    createdAt: row.created_at,
  }));
}
