import { z } from "zod";
import {
  OT_CLAIM_TYPES,
  OT_STATUSES,
  type OtClaimType,
  type OtStatus,
} from "@/lib/domain/ot-claim";
import { createClient } from "@/lib/supabase/server";

export type OtClaim = {
  id: string;
  profileId: string;
  workDate: string;
  fromTime: string;
  toTime: string;
  hours: number;
  mofNo: string;
  projectName: string;
  reason: string;
  claimAs: OtClaimType;
  status: OtStatus;
  approvedAs: OtClaimType | null;
  decidedBy: string | null;
};

export type MofOption = { id: string; label: string };

const claimRows = z.array(
  z.object({
    id: z.string(),
    profile_id: z.string(),
    work_date: z.string(),
    from_time: z.string(),
    to_time: z.string(),
    hours: z.number(),
    reason: z.string(),
    claim_as: z.enum(OT_CLAIM_TYPES),
    status: z.enum(OT_STATUSES),
    approved_as: z.enum(OT_CLAIM_TYPES).nullable(),
    decided_by: z.string().nullable(),
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }),
  }),
);

/** Newest first. The database returns your own claims, or everyone's for the MD, Sales Director and Accounts. */
export async function loadOtClaims(): Promise<OtClaim[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ot_claims")
    .select(
      "id, profile_id, work_date, from_time, to_time, hours, reason, claim_as, status, approved_as, decided_by, mofs!inner(mof_no, project_name)",
    )
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load overtime: ${error.message}`);

  return claimRows.parse(data).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    workDate: row.work_date,
    // The database sends "20:00:00"; the screen works in "20:00".
    fromTime: row.from_time.slice(0, 5),
    toTime: row.to_time.slice(0, 5),
    hours: row.hours,
    mofNo: row.mofs.mof_no,
    projectName: row.mofs.project_name,
    reason: row.reason,
    claimAs: row.claim_as,
    status: row.status,
    approvedAs: row.approved_as,
    decidedBy: row.decided_by,
  }));
}

const mofRows = z.array(
  z.object({ id: z.string(), mof_no: z.string(), project_name: z.string() }),
);

/** Orders that are not closed or cancelled: the sites overtime can be filed against. */
export async function loadMofOptions(): Promise<MofOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mofs")
    .select("id, mof_no, project_name")
    .not("stage", "in", "(closed,cancelled)")
    .order("mof_no", { ascending: false });
  if (error) throw new Error(`Could not load orders: ${error.message}`);

  return mofRows.parse(data).map((row) => ({
    id: row.id,
    label: `${row.mof_no} · ${row.project_name}`,
  }));
}
