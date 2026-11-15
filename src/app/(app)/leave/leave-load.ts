import { z } from "zod";
import type {
  LeaveApprovalStep,
  LeaveRequestParties,
} from "@/lib/domain/leave-approval";
import { LEAVE_STATUSES, LEAVE_TYPES } from "@/lib/domain/leave-balance";
import type { createClient } from "@/lib/supabase/server";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

const leaveRow = z.object({
  id: z.uuid(),
  person_id: z.uuid(),
  leave_type: z.enum(LEAVE_TYPES),
  status: z.enum(LEAVE_STATUSES),
  starts_on: z.iso.date(),
  slip_path: z.string().nullable(),
  leave_approval_steps: z.array(
    z.object({
      position: z.number(),
      approver_id: z.uuid().nullable(),
      approver_role: z.enum(["md", "director"]).nullable(),
      decision: z.enum(["approved", "rejected"]).nullable(),
    }),
  ),
});

export type LoadedLeave = LeaveRequestParties & {
  id: string;
  slipPath: string | null;
};

function toStep(
  step: z.infer<typeof leaveRow>["leave_approval_steps"][number],
): LeaveApprovalStep {
  const base = { position: step.position, decision: step.decision };
  if (step.approver_id) return { ...base, approverId: step.approver_id };
  if (step.approver_role) return { ...base, approverRole: step.approver_role };
  throw new Error("A leave approval step names nobody.");
}

/** The leave request as this person sees it, or null when row-level security hides it. */
export async function loadLeave(
  supabase: Supabase,
  id: string,
): Promise<LoadedLeave | null> {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, person_id, leave_type, status, starts_on, slip_path, leave_approval_steps(position, approver_id, approver_role, decision)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the leave: ${error.message}`);
  if (!data) return null;
  const row = leaveRow.parse(data);
  return {
    id: row.id,
    personId: row.person_id,
    leaveType: row.leave_type,
    status: row.status,
    startsOn: row.starts_on,
    hasSlip: row.slip_path !== null,
    slipPath: row.slip_path,
    steps: row.leave_approval_steps.map(toStep),
  };
}
