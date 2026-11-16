import { z } from "zod";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { createClient } from "@/lib/supabase/server";

export type Signoff = { name: string; at: string };

const logRows = z.array(
  z.object({
    status: z.string(),
    changed_at: z.string(),
    changed_by: z.uuid().nullable(),
  }),
);

/**
 * Who checked and approved a claim, and when it was submitted, for the printed form. They live
 * only in the status log, so the latest entry of each status wins (a returned claim is
 * checked again).
 */
export async function loadClaimSignoffs(claimId: string): Promise<{
  submittedAt: string | null;
  checked: Signoff | null;
  approved: Signoff | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_claim_log")
    .select("status, changed_at, changed_by")
    .eq("claim_id", claimId)
    .order("changed_at");
  if (error) throw new Error(`Could not load the claim log: ${error.message}`);
  const log = logRows.parse(data);
  // Staff cannot read other profiles, so the names come from the team directory.
  const nameOf = new Map(
    (await getTeamDirectory()).map((member) => [member.id, member.name]),
  );
  const latest = (status: string) =>
    log.filter((entry) => entry.status === status).at(-1) ?? null;
  const signoff = (status: string): Signoff | null => {
    const entry = latest(status);
    return entry
      ? { name: nameOf.get(entry.changed_by ?? "") ?? "", at: entry.changed_at }
      : null;
  };
  return {
    submittedAt: latest("submitted")?.changed_at ?? null,
    checked: signoff("checked"),
    approved: signoff("approved"),
  };
}
