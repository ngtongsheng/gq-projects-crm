import { z } from "zod";
import { loadMyTeam } from "@/lib/auth/my-team";
import { inMyTeam } from "@/lib/auth/team";
import { orderTotal } from "@/lib/domain/mof-totals";
import type {
  PerformanceOrder,
  PerformancePerson,
} from "@/lib/domain/sales-performance";
import { sumRm } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";

const mofRows = z.array(
  z.object({
    id: z.string(),
    salesperson_id: z.string(),
    loa_date: z.string(),
    contract_sum: z.number(),
    vo_amount: z.number(),
    payments: z.array(z.object({ amount: z.number() })),
  }),
);

const costRows = z.array(z.object({ mof_id: z.string(), cost: z.number() }));

const profileRows = z.array(
  z.object({
    id: z.string(),
    full_name: z.string().nullable(),
    yearly_target: z.coerce.number().nullable(),
  }),
);

/**
 * Every order that is not cancelled with what was invoiced and received, and everyone's yearly
 * target. Admins only: the database lets nobody else read other people's targets. Cost is
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
        "id, salesperson_id, loa_date, contract_sum, vo_amount, payments(amount)",
      )
      .neq("stage", "cancelled"),
    seesCost
      ? supabase.from("mof_costs").select("mof_id, cost")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("profiles").select("id, full_name, yearly_target"),
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
      salespersonId: row.salesperson_id,
      loaDate: row.loa_date,
      invoice: orderTotal({
        contractSum: row.contract_sum,
        voAmount: row.vo_amount,
      }),
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
      })),
  };
}
