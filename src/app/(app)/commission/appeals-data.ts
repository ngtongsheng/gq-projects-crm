import { z } from "zod";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { createClient } from "@/lib/supabase/server";
import { type AppealStatus, appealKey } from "./appeal-rules";

export type CommissionAppeal = {
  id: string;
  mofId: string;
  mofNo: string;
  companyName: string;
  projectName: string;
  personId: string;
  personName: string;
  status: AppealStatus;
  reason: string;
  reply: string | null;
  decidedByName: string | null;
  /** Timestamps, shown in Malaysia time. */
  sentAt: string;
  decidedAt: string | null;
};

const appealRows = z.array(
  z.object({
    id: z.string(),
    mof_id: z.string(),
    profile_id: z.string(),
    reason: z.string(),
    status: z.enum(["pending", "approved", "rejected"]),
    reply: z.string().nullable(),
    decided_by: z.string().nullable(),
    decided_at: z.string().nullable(),
    created_at: z.string(),
    mofs: z
      .object({
        mof_no: z.string(),
        company_name: z.string(),
        project_name: z.string(),
      })
      .nullable(),
  }),
);

/**
 * The appeals this person may read (their own; everyone's for the MD and HR & Accounts; their
 * team's for a director), waiting ones first, then newest first.
 */
export async function loadCommissionAppeals(): Promise<CommissionAppeal[]> {
  const supabase = await createClient();
  const [result, team] = await Promise.all([
    supabase
      .from("commission_appeals")
      .select(
        "id, mof_id, profile_id, reason, status, reply, decided_by, decided_at, created_at, mofs(mof_no, company_name, project_name)",
      )
      .order("created_at", { ascending: false }),
    getTeamDirectory(),
  ]);
  if (result.error) {
    throw new Error(`Could not load appeals: ${result.error.message}`);
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  return appealRows
    .parse(result.data)
    .flatMap((row) =>
      // An order the person cannot open has nothing to show them.
      row.mofs === null
        ? []
        : [
            {
              id: row.id,
              mofId: row.mof_id,
              mofNo: row.mofs.mof_no,
              companyName: row.mofs.company_name,
              projectName: row.mofs.project_name,
              personId: row.profile_id,
              personName: nameOf.get(row.profile_id) ?? "Unnamed",
              status: row.status,
              reason: row.reason,
              reply: row.reply,
              decidedByName: row.decided_by
                ? (nameOf.get(row.decided_by) ?? "Unnamed")
                : null,
              sentAt: row.created_at,
              decidedAt: row.decided_at,
            },
          ],
    )
    .sort(
      (a, b) =>
        Number(b.status === "pending") - Number(a.status === "pending") ||
        b.sentAt.localeCompare(a.sentAt),
    );
}

/** The appeal that counts for each person and order: a waiting or approved one, else the newest rejected. */
export function latestAppealByLine(
  appeals: readonly CommissionAppeal[],
): Map<string, CommissionAppeal> {
  const byLine = new Map<string, CommissionAppeal>();
  for (const appeal of appeals) {
    const key = appealKey(appeal.mofId, appeal.personId);
    if (!byLine.has(key)) byLine.set(key, appeal);
  }
  return byLine;
}
