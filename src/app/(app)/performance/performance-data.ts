import { z } from "zod";
import { JobRole } from "@/lib/auth/job-role";
import { loadMyTeam } from "@/lib/auth/my-team";
import { inMyTeam } from "@/lib/auth/team";
import { MOF_STAGES } from "@/lib/domain/mof-stages";
import type {
  PerformanceOrder,
  PerformancePerson,
} from "@/lib/domain/sales-performance";
import { sumRm } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";

const mofRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    project_name: z.string(),
    company_name: z.string(),
    stage: z.enum(MOF_STAGES),
    salesperson_id: z.string(),
    loa_date: z.string(),
    contract_sum: z.number(),
    mof_variation_orders: z.array(
      z.object({ confirmed_on: z.string(), amount: z.coerce.number() }),
    ),
    payments: z.array(z.object({ amount: z.number() })),
  }),
);

const costRows = z.array(z.object({ mof_id: z.string(), cost: z.number() }));

const profileRows = z.array(
  z.object({
    id: z.string(),
    full_name: z.string().nullable(),
    yearly_target: z.coerce.number().nullable(),
    job_role: JobRole,
    reports_to: z.string().nullable(),
    joined_on: z.string().nullable(),
    left_on: z.string().nullable(),
  }),
);

/**
 * Every order that is not cancelled with its contract sum, variation orders and what was
 * received, and everyone's yearly target, join and leave dates and team lead. Admins only: the database lets nobody else read other people's targets. Cost is
 * asked for only when the viewer may see it.
 */
export async function loadPerformance(seesCost: boolean): Promise<{
  orders: PerformanceOrder[];
  people: PerformancePerson[];
}> {
  const supabase = await createClient();
  const [mofsResult, costsResult, profilesResult, team] = await Promise.all([
    supabase
      .from("mofs")
      .select(
        "id, mof_no, project_name, company_name, stage, salesperson_id, loa_date, contract_sum, mof_variation_orders(confirmed_on, amount), payments(amount)",
      )
      .neq("stage", "cancelled"),
    seesCost
      ? supabase.from("mof_cost_totals").select("mof_id, cost")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("profiles")
      .select(
        "id, full_name, yearly_target, job_role, reports_to, joined_on, left_on",
      ),
    loadMyTeam(),
  ]);
  if (mofsResult.error) {
    throw new Error(`Could not load orders: ${mofsResult.error.message}`);
  }
  if (costsResult.error) {
    throw new Error(`Could not load costs: ${costsResult.error.message}`);
  }
  if (profilesResult.error) {
    throw new Error(`Could not load people: ${profilesResult.error.message}`);
  }

  const costOf = new Map(
    costRows.parse(costsResult.data).map((row) => [row.mof_id, row.cost]),
  );
  return {
    orders: mofRows.parse(mofsResult.data).map((row) => ({
      mofId: row.id,
      mofNo: row.mof_no,
      projectName: row.project_name,
      companyName: row.company_name,
      stage: row.stage,
      salespersonId: row.salesperson_id,
      loaDate: row.loa_date,
      contractSum: row.contract_sum,
      variationOrders: row.mof_variation_orders.map((vo) => ({
        confirmedOn: vo.confirmed_on,
        amount: vo.amount,
      })),
      received: sumRm(row.payments.map((payment) => payment.amount)),
      cost: costOf.get(row.id) ?? null,
    })),
    // Orders are already the team's (mofs policy); people with a target are listed even without
    // sales, so a director's list is cut to the team here.
    people: profileRows
      .parse(profilesResult.data)
      .filter((row) => inMyTeam(team, row.id))
      .map((row) => ({
        id: row.id,
        name: row.full_name ?? "Unnamed",
        yearlyTarget: row.yearly_target,
        joinedOn: row.joined_on,
        leftOn: row.left_on,
        jobRole: row.job_role,
        reportsTo: row.reports_to,
      })),
  };
}
