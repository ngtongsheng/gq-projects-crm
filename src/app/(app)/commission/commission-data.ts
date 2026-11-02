import { z } from "zod";
import { CommissionMode } from "@/lib/auth/job-role";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  type CommissionPerson,
  calculateCommission,
  type MarginTier,
  type PersonCommission,
} from "@/lib/domain/commission";
import {
  type CommissionBalance,
  commissionBalance,
} from "@/lib/domain/commission-balance";
import { orderTotal } from "@/lib/domain/mof-totals";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { loadCommissionSettings } from "./commission-settings-data";

export type Payout = {
  id: string;
  amount: number;
  paidOn: string;
  note: string | null;
};

/** One person's commission on one order. */
export type CommissionLine = {
  mofId: string;
  mofNo: string;
  companyName: string;
  projectName: string;
  loaDate: string;
  personId: string;
  personName: string;
  commission: PersonCommission;
  balance: CommissionBalance;
  pctPaid: number;
  tier: MarginTier;
  /** Why the order's commission stands where it does, margin and lateness included. */
  orderNotes: string[];
  payouts: Payout[];
};

const MARGIN_TIER = z.enum(["unknown", "none", "low", "standard", "high"]);
const commissionType = z.enum(["own", "pass_down", "company"]);

const mofRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    company_name: z.string(),
    project_name: z.string(),
    loa_date: z.string(),
    invoice_date: z.string().nullable(),
    contract_sum: z.number(),
    vo_amount: z.number(),
    commission_type: commissionType,
    salesperson_id: z.string(),
    second_salesperson_id: z.string().nullable(),
    payments: z.array(
      z.object({ amount: z.number(), received_on: z.string() }),
    ),
    commission_payouts: z.array(
      z.object({
        id: z.string(),
        profile_id: z.string(),
        amount: z.number(),
        paid_on: z.string(),
        note: z.string().nullable(),
      }),
    ),
  }),
);

const basisRows = z.array(
  z.object({
    mof_id: z.string(),
    margin_tier: MARGIN_TIER,
    salesperson_mode: CommissionMode.nullable(),
    second_salesperson_mode: CommissionMode.nullable(),
    passed_by_id: z.string().nullable(),
    passed_by_mode: CommissionMode.nullable(),
  }),
);

/**
 * Commission per person per order, for the orders this person may see: all of them for the MD,
 * Sales Director and HR & Accounts, their own for a salesperson. The database decides which;
 * the cost never leaves it, only the margin tier (commission_basis).
 */
export async function loadCommissionLines(
  mofId?: string,
): Promise<CommissionLine[]> {
  const supabase = await createClient();
  const query = supabase
    .from("mofs")
    .select(
      "id, mof_no, company_name, project_name, loa_date, invoice_date, contract_sum, vo_amount, commission_type, salesperson_id, second_salesperson_id, payments(amount, received_on), commission_payouts(id, profile_id, amount, paid_on, note)",
    )
    .neq("stage", "cancelled")
    .order("loa_date", { ascending: false })
    .order("mof_no", { ascending: false });
  const [mofsResult, basisResult, team, settings] = await Promise.all([
    mofId ? query.eq("id", mofId) : query,
    supabase.rpc("commission_basis"),
    getTeamDirectory(),
    loadCommissionSettings(),
  ]);
  if (mofsResult.error) {
    throw new Error(`Could not load commission: ${mofsResult.error.message}`);
  }
  if (basisResult.error) {
    throw new Error(`Could not load commission: ${basisResult.error.message}`);
  }

  const basisByMof = new Map(
    basisRows.parse(basisResult.data).map((row) => [row.mof_id, row]),
  );
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const today = todayMyt();
  const lines: CommissionLine[] = [];

  for (const mof of mofRows.parse(mofsResult.data)) {
    const basis = basisByMof.get(mof.id);
    if (!basis) continue;

    const modes: [string | null, CommissionMode | null][] = [
      [mof.salesperson_id, basis.salesperson_mode],
      [mof.second_salesperson_id, basis.second_salesperson_mode],
      [basis.passed_by_id, basis.passed_by_mode],
    ];
    const people: CommissionPerson[] = modes.flatMap(([id, mode]) =>
      id === null
        ? []
        : [
            {
              id,
              name: nameOf.get(id) ?? "Unnamed",
              commissionMode: mode ?? "standard",
            },
          ],
    );
    const result = calculateCommission({
      mof: {
        total: orderTotal({
          contractSum: mof.contract_sum,
          voAmount: mof.vo_amount,
        }),
        commissionType: mof.commission_type,
        invoiceDate: mof.invoice_date,
        loaDate: mof.loa_date,
        salespersonId: mof.salesperson_id,
        secondSalespersonId: mof.second_salesperson_id,
        passedById: basis.passed_by_id,
      },
      cost: null,
      knownTier: basis.margin_tier,
      payments: mof.payments.map((payment) => ({
        amount: payment.amount,
        receivedOn: payment.received_on,
      })),
      people,
      settings,
      today,
    });

    for (const commission of result.people) {
      const payouts = mof.commission_payouts
        .filter((payout) => payout.profile_id === commission.personId)
        .map((payout) => ({
          id: payout.id,
          amount: payout.amount,
          paidOn: payout.paid_on,
          note: payout.note,
        }))
        .sort(
          (a, b) =>
            b.paidOn.localeCompare(a.paidOn) || a.id.localeCompare(b.id),
        );
      lines.push({
        mofId: mof.id,
        mofNo: mof.mof_no,
        companyName: mof.company_name,
        projectName: mof.project_name,
        loaDate: mof.loa_date,
        personId: commission.personId,
        personName: commission.name,
        commission,
        balance: commissionBalance(
          commission,
          payouts.map((payout) => payout.amount),
        ),
        pctPaid: result.pctPaid,
        tier: result.tier,
        orderNotes: result.lines,
        payouts,
      });
    }
  }
  return lines;
}
