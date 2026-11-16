import { z } from "zod";
import type { JobPeople } from "@/lib/domain/job-team";
import { createClient } from "@/lib/supabase/server";
import { loadSiteSupervisors } from "./booking-data";
import { loadInstallerChoices } from "./installer-data";

const salespeopleRows = z.array(
  z.object({ id: z.uuid(), full_name: z.string().nullable() }),
);

export async function loadSalespeople(): Promise<JobPeople["salespeople"]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("salespeople");
  if (error) throw new Error(`Could not load salespeople: ${error.message}`);
  return salespeopleRows
    .parse(data)
    .map((row) => ({ id: row.id, name: row.full_name ?? "Unnamed" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The installers, site supervisors and salespeople a job can be given. */
export async function loadJobPeople(): Promise<JobPeople> {
  const [installers, supervisors, salespeople] = await Promise.all([
    loadInstallerChoices(),
    loadSiteSupervisors(),
    loadSalespeople(),
  ]);
  return { installers, supervisors, salespeople };
}
