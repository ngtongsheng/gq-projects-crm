import { z } from "zod";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { MOF_STAGES, type MofStageKey } from "@/lib/domain/mof-stages";
import {
  daysOutstanding,
  type Margin,
  marginOf,
  receivedPct,
} from "@/lib/domain/mof-summary";
import { orderTotal, totalAreaM2 } from "@/lib/domain/mof-totals";
import { todayMyt } from "@/lib/format/date";
import { fromCents, sumRm, toCents } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";
import { JobScope, LineUnit } from "../schemas";

const mofRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    loa_date: z.string(),
    salesperson_id: z.string(),
    second_salesperson_id: z.string().nullable(),
    company_name: z.string(),
    project_name: z.string(),
    customer_contact: z.string().nullable(),
    accounts_contact: z.string().nullable(),
    scope: JobScope,
    installer_name: z.string().nullable(),
    contract_sum: z.number(),
    vo_amount: z.number(),
    retention_pct: z.number().nullable(),
    invoice_no: z.string().nullable(),
    invoice_date: z.string().nullable(),
    delivery_date: z.string().nullable(),
    stage: z.enum(MOF_STAGES),
    mof_lines: z.array(
      z.object({
        product: z.string(),
        qty: z.number(),
        unit: LineUnit,
        area_m2: z.number(),
      }),
    ),
    payments: z.array(z.object({ amount: z.number() })),
  }),
);

const costRows = z.array(z.object({ mof_id: z.string(), cost: z.number() }));

export type SummaryRow = {
  id: string;
  mofNo: string;
  loaDate: string;
  salespersonId: string;
  secondSalespersonId: string | null;
  people: string;
  companyName: string;
  projectName: string;
  customerContact: string | null;
  accountsContact: string | null;
  scope: z.infer<typeof JobScope>;
  /** The product types on the MOF, e.g. "Carpet Tile, Wallpaper". */
  products: string;
  installer: string | null;
  invoice: number;
  received: number;
  balance: number;
  receivedPct: number | null;
  retentionPct: number | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  daysOutstanding: number | null;
  /** Null when no cost has been entered yet. */
  cost: number | null;
  margin: Margin | null;
  areaM2: number;
  deliveryDate: string | null;
  stage: MofStageKey;
};

/** Sum for the footer line: cancelled MOFs are left out. */
export type SummaryTotals = {
  count: number;
  invoice: number;
  received: number;
  balance: number;
  cost: number;
  margin: number;
  marginPct: number | null;
};

/**
 * One line per MOF with what was invoiced, received and spent. Only call it for a person who may
 * see cost: the database hides cost and other people's payments from everyone else anyway.
 */
export async function loadSummary(): Promise<SummaryRow[]> {
  const supabase = await createClient();
  const [mofsResult, costsResult, team] = await Promise.all([
    supabase
      .from("mofs")
      .select(
        "id, mof_no, loa_date, salesperson_id, second_salesperson_id, company_name, project_name, customer_contact, accounts_contact, scope, installer_name, contract_sum, vo_amount, retention_pct, invoice_no, invoice_date, delivery_date, stage, mof_lines(product, qty, unit, area_m2), payments(amount)",
      )
      .order("loa_date", { ascending: false })
      .order("mof_no", { ascending: false }),
    supabase.from("mof_costs").select("mof_id, cost"),
    getTeamDirectory(),
  ]);
  if (mofsResult.error) {
    throw new Error(`Could not load the summary: ${mofsResult.error.message}`);
  }
  if (costsResult.error) {
    throw new Error(`Could not load the costs: ${costsResult.error.message}`);
  }
  const costOf = new Map(
    costRows.parse(costsResult.data).map((row) => [row.mof_id, row.cost]),
  );
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const personName = (id: string) => nameOf.get(id) ?? "Unnamed";
  const today = todayMyt();

  return mofRows.parse(mofsResult.data).map((row) => {
    const invoice = orderTotal({
      contractSum: row.contract_sum,
      voAmount: row.vo_amount,
    });
    const received = sumRm(row.payments.map((payment) => payment.amount));
    const balance = fromCents(
      Math.max(0, toCents(invoice) - toCents(received)),
    );
    const cost = costOf.get(row.id) ?? null;
    return {
      id: row.id,
      mofNo: row.mof_no,
      loaDate: row.loa_date,
      salespersonId: row.salesperson_id,
      secondSalespersonId: row.second_salesperson_id,
      people: [
        personName(row.salesperson_id),
        row.second_salesperson_id
          ? personName(row.second_salesperson_id)
          : null,
      ]
        .filter(Boolean)
        .join(" + "),
      companyName: row.company_name,
      projectName: row.project_name,
      customerContact: row.customer_contact,
      accountsContact: row.accounts_contact,
      scope: row.scope,
      products: [...new Set(row.mof_lines.map((line) => line.product))].join(
        ", ",
      ),
      installer: row.installer_name,
      invoice,
      received,
      balance,
      receivedPct: receivedPct(invoice, received),
      retentionPct: row.retention_pct,
      invoiceNo: row.invoice_no,
      invoiceDate: row.invoice_date,
      daysOutstanding: daysOutstanding(row.invoice_date, balance, today),
      cost,
      margin: cost === null ? null : marginOf(invoice, cost),
      areaM2: totalAreaM2(
        row.mof_lines.map((line) => ({
          qty: line.qty,
          unit: line.unit,
          areaM2: line.area_m2,
        })),
      ),
      deliveryDate: row.delivery_date,
      stage: row.stage,
    };
  });
}

/** Footer figures. Margin counts only MOFs that have a cost, so a missing cost never inflates it. */
export function summaryTotals(rows: readonly SummaryRow[]): SummaryTotals {
  const live = rows.filter((row) => row.stage !== "cancelled");
  const costed = live.filter((row) => row.cost !== null);
  const costedInvoice = sumRm(costed.map((row) => row.invoice));
  const cost = sumRm(costed.map((row) => row.cost ?? 0));
  const { margin, marginPct } = marginOf(costedInvoice, cost);
  return {
    count: live.length,
    invoice: sumRm(live.map((row) => row.invoice)),
    received: sumRm(live.map((row) => row.received)),
    balance: sumRm(live.map((row) => row.balance)),
    cost,
    margin,
    marginPct,
  };
}
