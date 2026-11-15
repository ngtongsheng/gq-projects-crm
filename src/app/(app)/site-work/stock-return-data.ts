import { z } from "zod";
import { SITE_ACTIVITIES } from "@/lib/domain/site-log";
import type { StockReturnLog } from "@/lib/domain/site-stock-returns";
import { addDays, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

const RECENT_DAYS = 90;

const logRows = z.array(
  z.object({
    visited_on: z.iso.date(),
    supervisor_id: z.string(),
    activity: z.enum(SITE_ACTIVITIES),
    mof_id: z.string().nullable(),
    site_name: z.string().nullable(),
    return_answer: z.string().nullable(),
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }).nullable(),
  }),
);

/** The last three months' logs that are a stock return or carry a balance stock answer. */
export async function loadStockReturnLogs(): Promise<StockReturnLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_logs")
    .select(
      "visited_on, supervisor_id, activity, mof_id, site_name, return_answer, mofs(mof_no, project_name)",
    )
    .gte("visited_on", addDays(todayMyt(), -RECENT_DAYS))
    .or("activity.eq.stock_return,return_answer.not.is.null");
  if (error) {
    throw new Error(`Could not load the stock returns: ${error.message}`);
  }
  return logRows.parse(data).map((row) => ({
    visitedOn: row.visited_on,
    supervisorId: row.supervisor_id,
    activity: row.activity,
    mofId: row.mof_id,
    mofNo: row.mofs?.mof_no ?? null,
    siteLabel: row.mofs?.project_name ?? row.site_name ?? "",
    returnAnswer: row.return_answer,
  }));
}
