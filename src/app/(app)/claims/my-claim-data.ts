import { z } from "zod";
import { CLAIM_STATUSES } from "@/lib/domain/claim-flow";
import { CLAIM_EXPENSE_TYPES } from "@/lib/domain/monthly-claim";
import type { CalendarDate } from "@/lib/format/date";
import { sumRm } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";

export const claimHead = z
  .object({
    id: z.uuid(),
    status: z.enum(CLAIM_STATUSES),
    note: z.string(),
    remark: z.string(),
    return_reason: z.string().nullable(),
    original_receipts_received: z.boolean(),
    ot_original_amount: z.coerce.number().nullable(),
    ot_amount: z.coerce.number().nullable(),
    ot_adjustment_reason: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    status: row.status,
    note: row.note,
    remark: row.remark,
    returnReason: row.return_reason,
    originalReceiptsReceived: row.original_receipts_received,
    otOriginalAmount: row.ot_original_amount,
    otAmount: row.ot_amount,
    otAdjustmentReason: row.ot_adjustment_reason,
  }));
export type ClaimHead = z.output<typeof claimHead>;

export const HEAD_COLUMNS =
  "id, status, note, remark, return_reason, original_receipts_received, ot_original_amount, ot_amount, ot_adjustment_reason";

const expenseRows = z.array(
  z.object({
    id: z.uuid(),
    spent_on: z.iso.date(),
    expense_type: z.enum(CLAIM_EXPENSE_TYPES),
    description: z.string(),
    km: z.coerce.number().nullable(),
    nights: z.number().nullable(),
    original_amount: z.coerce.number(),
    amount: z.coerce.number(),
    adjustment_reason: z.string().nullable(),
    receipt_no: z.number().nullable(),
    receipt_path: z.string().nullable(),
  }),
);

export type ExpenseLine = {
  id: string;
  spentOn: CalendarDate;
  expenseType: (typeof CLAIM_EXPENSE_TYPES)[number];
  description: string;
  km: number | null;
  nights: number | null;
  originalAmount: number;
  amount: number;
  adjustmentReason: string | null;
  receiptNo: number | null;
  hasReceipt: boolean;
};

const commissionRows = z.array(
  z.object({
    mof_id: z.uuid(),
    late_cut_amount: z.coerce.number(),
    late_cut_waived: z.boolean(),
    original_amount: z.coerce.number(),
    amount: z.coerce.number(),
    adjustment_reason: z.string().nullable(),
    mofs: z.object({
      mof_no: z.string(),
      company_name: z.string(),
      project_name: z.string(),
    }),
  }),
);

/** A commission line already in the claim. */
export type StoredCommissionLine = {
  mofId: string;
  mofNo: string;
  companyName: string;
  projectName: string;
  lateCut: number;
  lateCutWaived: boolean;
  originalAmount: number;
  amount: number;
  adjustmentReason: string | null;
};

/** The person's claim for a month, or nulls when nothing was started. Row-level security limits it to their own. */
export async function loadMyClaim(personId: string, month: CalendarDate) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_claims")
    .select(HEAD_COLUMNS)
    .eq("profile_id", personId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(`Could not load your claim: ${error.message}`);
  if (!data) {
    return { head: null, expenses: [], commissions: [] };
  }
  const head = claimHead.parse(data);

  return { head, ...(await loadClaimLines(supabase, head.id)) };
}

/** A claim's expense and commission lines, in the order the person entered them. */
export async function loadClaimLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  claimId: string,
) {
  const [expenses, commissions] = await Promise.all([
    supabase
      .from("monthly_claim_expenses")
      .select(
        "id, spent_on, expense_type, description, km, nights, original_amount, amount, adjustment_reason, receipt_no, receipt_path",
      )
      .eq("claim_id", claimId)
      .order("spent_on")
      .order("created_at"),
    supabase
      .from("monthly_claim_commissions")
      .select(
        "mof_id, late_cut_amount, late_cut_waived, original_amount, amount, adjustment_reason, mofs!inner(mof_no, company_name, project_name)",
      )
      .eq("claim_id", claimId)
      .order("created_at"),
  ]);
  if (expenses.error) {
    throw new Error(`Could not load the expenses: ${expenses.error.message}`);
  }
  if (commissions.error) {
    throw new Error(
      `Could not load the commission lines: ${commissions.error.message}`,
    );
  }

  return {
    expenses: expenseRows.parse(expenses.data).map(
      (row): ExpenseLine => ({
        id: row.id,
        spentOn: row.spent_on,
        expenseType: row.expense_type,
        description: row.description,
        km: row.km,
        nights: row.nights,
        originalAmount: row.original_amount,
        amount: row.amount,
        adjustmentReason: row.adjustment_reason,
        receiptNo: row.receipt_no,
        hasReceipt: row.receipt_path !== null,
      }),
    ),
    commissions: commissionRows.parse(commissions.data).map(
      (row): StoredCommissionLine => ({
        mofId: row.mof_id,
        mofNo: row.mofs.mof_no,
        companyName: row.mofs.company_name,
        projectName: row.mofs.project_name,
        lateCut: row.late_cut_amount,
        lateCutWaived: row.late_cut_waived,
        originalAmount: row.original_amount,
        amount: row.amount,
        adjustmentReason: row.adjustment_reason,
      }),
    ),
  };
}

const earlierRows = z.array(
  z.object({
    month: z.iso.date(),
    status: z.enum(CLAIM_STATUSES),
    monthly_claim_commissions: z.array(z.object({ amount: z.coerce.number() })),
    monthly_claim_expenses: z.array(z.object({ amount: z.coerce.number() })),
  }),
);

export type ClaimSummary = {
  month: CalendarDate;
  status: (typeof CLAIM_STATUSES)[number];
  commission: number;
  expenses: number;
  lineCount: number;
};

/** The person's latest claims, newest first, for the month switch and the "Earlier claims" table. */
export async function loadMyClaimList(
  personId: string,
): Promise<ClaimSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_claims")
    .select(
      "month, status, monthly_claim_commissions(amount), monthly_claim_expenses(amount)",
    )
    .eq("profile_id", personId)
    .order("month", { ascending: false })
    .limit(8);
  if (error) {
    throw new Error(`Could not load your claims: ${error.message}`);
  }
  return earlierRows.parse(data).map((row) => ({
    month: row.month,
    status: row.status,
    commission: sumRm(row.monthly_claim_commissions.map((line) => line.amount)),
    expenses: sumRm(row.monthly_claim_expenses.map((line) => line.amount)),
    lineCount:
      row.monthly_claim_commissions.length + row.monthly_claim_expenses.length,
  }));
}
