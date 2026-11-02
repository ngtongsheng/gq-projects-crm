import { z } from "zod";
import { JobRole } from "@/lib/auth/job-role";
import { type ReportKind, reportKindFor } from "@/lib/domain/report-stats";
import { createClient } from "@/lib/supabase/server";

export type ReportFiler = { id: string; name: string; kind: ReportKind };

const filerRows = z.array(
  z.object({
    id: z.uuid(),
    full_name: z.string().nullable(),
    job_role: JobRole,
  }),
);

/** People who file a monthly report that the caller may see (managers only; the database decides). */
export async function loadReportFilers(): Promise<ReportFiler[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_filers");
  if (error)
    throw new Error(`Could not load the report filers: ${error.message}`);
  return filerRows
    .parse(data)
    .flatMap((row) => {
      const kind = reportKindFor(row.job_role);
      return kind
        ? [{ id: row.id, name: row.full_name ?? "Unnamed", kind }]
        : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
