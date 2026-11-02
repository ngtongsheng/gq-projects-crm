import { z } from "zod";
import { DEFAULT_PAYMENT_THRESHOLD_PCT } from "@/lib/domain/collection";
import { MOF_STAGES, type MofStageKey } from "@/lib/domain/mof-stages";
import { orderTotal } from "@/lib/domain/mof-totals";
import { createClient } from "@/lib/supabase/server";

export type Payment = {
  id: string;
  amount: number;
  receivedOn: string;
  note: string | null;
};

export type CollectionOrder = {
  id: string;
  mofNo: string;
  loaDate: string;
  stage: MofStageKey;
  invoiceDate: string | null;
  companyName: string;
  projectName: string;
  salespersonId: string;
  secondSalespersonId: string | null;
  /** The invoice amount: contract sum plus variation orders. */
  invoice: number;
  invoiceNo: string | null;
  payments: Payment[];
};

const orderRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    loa_date: z.string(),
    stage: z.enum(MOF_STAGES),
    invoice_date: z.string().nullable(),
    company_name: z.string(),
    project_name: z.string(),
    salesperson_id: z.string(),
    second_salesperson_id: z.string().nullable(),
    contract_sum: z.number(),
    vo_amount: z.number(),
    invoice_no: z.string().nullable(),
    payments: z.array(
      z.object({
        id: z.string(),
        amount: z.number(),
        received_on: z.string(),
        note: z.string().nullable(),
      }),
    ),
  }),
);

/**
 * Every order that has not been cancelled, newest first, with its payments. The database
 * returns only the payments this person may see.
 */
export async function loadCollectionOrders(): Promise<CollectionOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mofs")
    .select(
      "id, mof_no, loa_date, stage, invoice_date, company_name, project_name, salesperson_id, second_salesperson_id, contract_sum, vo_amount, invoice_no, payments(id, amount, received_on, note)",
    )
    .neq("stage", "cancelled")
    .order("loa_date", { ascending: false })
    .order("mof_no", { ascending: false });
  if (error) throw new Error(`Could not load collection: ${error.message}`);

  return orderRows.parse(data).map((row) => ({
    id: row.id,
    mofNo: row.mof_no,
    loaDate: row.loa_date,
    stage: row.stage,
    invoiceDate: row.invoice_date,
    companyName: row.company_name,
    projectName: row.project_name,
    salespersonId: row.salesperson_id,
    secondSalespersonId: row.second_salesperson_id,
    invoice: orderTotal({
      contractSum: row.contract_sum,
      voAmount: row.vo_amount,
    }),
    invoiceNo: row.invoice_no,
    payments: row.payments
      .map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        receivedOn: payment.received_on,
        note: payment.note,
      }))
      .sort(
        (a, b) =>
          b.receivedOn.localeCompare(a.receivedOn) || a.id.localeCompare(b.id),
      ),
  }));
}

/** The share paid before commission opens. Seeded by the payments migration. */
export async function loadPaymentThreshold(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "payment_threshold_pct")
    .maybeSingle();
  if (error) throw new Error(`Could not load the setting: ${error.message}`);
  const parsed = z.number().min(1).max(100).safeParse(data?.value);
  return parsed.success ? parsed.data : DEFAULT_PAYMENT_THRESHOLD_PCT;
}
