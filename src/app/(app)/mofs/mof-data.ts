import { z } from "zod";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { isFinalStage } from "@/lib/domain/mof-stages";
import {
  needsSupplierPo,
  orderTotal,
  totalAreaM2,
} from "@/lib/domain/mof-totals";
import {
  hasLiveSupplierPo,
  SUPPLIER_PO_STATUSES,
} from "@/lib/domain/supplier-po";
import { createClient } from "@/lib/supabase/server";
import { LineUnit, MofStage, StockType } from "./schemas";

const mofRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    loa_date: z.string(),
    salesperson_id: z.string(),
    second_salesperson_id: z.string().nullable(),
    company_name: z.string(),
    project_name: z.string(),
    contract_sum: z.number(),
    vo_amount: z.number(),
    delivery_date: z.string().nullable(),
    stage: MofStage,
    latest_update: z.string().nullable(),
    payment_checked: z.boolean(),
    approvals_in_writing: z.boolean(),
    artwork_signed_off: z.boolean(),
    dos_pre_approved: z.boolean(),
    mof_lines: z.array(
      z.object({
        stock_type: StockType,
        qty: z.number(),
        unit: LineUnit,
        area_m2: z.number(),
      }),
    ),
    supplier_pos: z.array(z.object({ status: z.enum(SUPPLIER_PO_STATUSES) })),
  }),
);

export type RegisterRow = {
  id: string;
  mofNo: string;
  loaDate: string;
  salespersonId: string;
  secondSalespersonId: string | null;
  people: string;
  companyName: string;
  projectName: string;
  total: number;
  deliveryDate: string | null;
  stage: MofStage;
  latestUpdate: string | null;
  ticks: number;
  /** Needs a supplier PO (indent, custom made or big order) and has none yet. */
  missingSupplierPo: boolean;
};

/** Every MOF the signed-in person can see, newest LOA first. Callers narrow it with `visibleMofs`. */
export async function loadRegister(): Promise<RegisterRow[]> {
  const supabase = await createClient();
  const [mofsResult, team] = await Promise.all([
    supabase
      .from("mofs")
      .select(
        "id, mof_no, loa_date, salesperson_id, second_salesperson_id, company_name, project_name, contract_sum, vo_amount, delivery_date, stage, latest_update, payment_checked, approvals_in_writing, artwork_signed_off, dos_pre_approved, mof_lines(stock_type, qty, unit, area_m2), supplier_pos(status)",
      )
      .order("loa_date", { ascending: false })
      .order("mof_no", { ascending: false }),
    getTeamDirectory(),
  ]);
  if (mofsResult.error) {
    throw new Error(`Could not load MOFs: ${mofsResult.error.message}`);
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const personName = (id: string) => nameOf.get(id) ?? "Unnamed";

  return mofRows.parse(mofsResult.data).map((row) => {
    const lines = row.mof_lines.map((line) => ({
      stockType: line.stock_type,
      qty: line.qty,
      unit: line.unit,
      areaM2: line.area_m2,
    }));
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
      total: orderTotal({
        contractSum: row.contract_sum,
        voAmount: row.vo_amount,
      }),
      deliveryDate: row.delivery_date,
      stage: row.stage,
      latestUpdate: row.latest_update,
      ticks: [
        row.payment_checked,
        row.approvals_in_writing,
        row.artwork_signed_off,
        row.dos_pre_approved,
      ].filter(Boolean).length,
      missingSupplierPo:
        !isFinalStage(row.stage) &&
        needsSupplierPo(lines, totalAreaM2(lines)) &&
        !hasLiveSupplierPo(row.supplier_pos),
    };
  });
}
