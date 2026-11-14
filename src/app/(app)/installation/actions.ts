"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canScheduleJobs, canUpdateJobStatus } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import {
  isDoRunningNo,
  JOB_STATUSES,
  JOB_TYPES,
} from "@/lib/domain/delivery-status";
import { optionalId, optionalText, textField } from "@/lib/form/form-fields";
import { isClockTime } from "@/lib/format/clock-time";
import { createClient } from "@/lib/supabase/server";
import { mofIdSchema } from "../mofs/schemas";

export type JobResult = { error: string | null };

const NOT_SCHEDULER =
  "Only the MD, Sales Director or Purchasing can schedule jobs.";
const NOT_FOUND_JOB = "Could not find that job. Reload the page.";
const DO_NO_NEEDED = "Key in the Zoho DO no. before marking the delivery Done.";
const TRY_AGAIN = "Could not save the job. Try again.";

const jobForm = z
  .object({
    mofId: mofIdSchema,
    jobType: z.enum(JOB_TYPES, "Choose the job type."),
    scheduledOn: z.iso.date("Choose the start date."),
    endsOn: z.iso.date("Choose the end date."),
    startTime: z
      .union([
        z.literal(""),
        z.string().refine(isClockTime, "Enter the time as HH:MM."),
      ])
      .transform((value) => (value === "" ? null : value)),
    installer: optionalText(100, "Keep the installer under 100 characters."),
    siteSupervisorId: optionalId(
      "Could not find that person. Reload the page.",
    ),
    notes: optionalText(300, "Keep the notes under 300 characters."),
  })
  .refine((job) => job.endsOn >= job.scheduledOn, {
    message: "The end date cannot be before the start date.",
    path: ["endsOn"],
  });

const tick = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

const deliveryForm = z.object({
  runningNo: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || isDoRunningNo(value),
      "Key in only the 4-digit Zoho running no., e.g. 5563. The MOF number is added in front.",
    )
    .transform((value) => (value === "" ? null : value)),
  transporter: optionalText(100, "Keep the transporter under 100 characters."),
  deliveredOn: z
    .union([z.literal(""), z.iso.date("Choose the delivered date.")])
    .transform((value) => (value === "" ? null : value)),
  items: optionalText(200, "Keep the items under 200 characters."),
  isFinal: tick,
  signedReturned: tick,
});

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Maps a database refusal to a message she can act on, or null when it is something else. */
function refusal(error: { code?: string; message?: string }): string | null {
  if (error.code === "42501") return NOT_SCHEDULER;
  if (error.code === "23514" && error.message?.includes("Zoho")) {
    return DO_NO_NEEDED;
  }
  if (error.code === "23503") {
    return "Could not find that MOF or person. Reload the page.";
  }
  return null;
}

const usedMessage = (runningNo: string) =>
  `Running no. ${runningNo} is already used by another DO. Check Zoho.`;

/** The message to show when the running no. cannot be used, or null when it is free. */
async function runningNoProblem(
  supabase: Supabase,
  runningNo: string,
  exceptJobId: string | null,
): Promise<string | null> {
  let query = supabase
    .from("delivery_orders")
    .select("id")
    .eq("running_no", runningNo);
  if (exceptJobId) query = query.neq("job_id", exceptJobId);
  const { data, error } = await query;
  if (error) {
    console.error("Could not check the DO no.", error);
    return TRY_AGAIN;
  }
  return data.length > 0 ? usedMessage(runningNo) : null;
}

/**
 * Schedules a job for an MOF, or changes one when the form carries a jobId. A delivery job
 * carries its DO details too. The type is fixed once the job exists; a new job starts
 * Scheduled, so a delivery cannot be Done before its DO exists.
 */
export async function saveJob(formData: FormData): Promise<JobResult> {
  const me = await requirePage("inst");
  if (!canScheduleJobs(me.jobRole)) return { error: NOT_SCHEDULER };

  const jobId = textField(formData, "jobId");
  if (jobId !== "" && !z.uuid().safeParse(jobId).success) {
    return { error: NOT_FOUND_JOB };
  }
  const editing = jobId !== "";

  const parsed = jobForm.safeParse({
    mofId: textField(formData, "mofId"),
    jobType: textField(formData, "jobType"),
    scheduledOn: textField(formData, "scheduledOn"),
    endsOn: textField(formData, "endsOn"),
    startTime: textField(formData, "startTime"),
    installer: textField(formData, "installer"),
    siteSupervisorId: textField(formData, "siteSupervisorId"),
    notes: textField(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const job = parsed.data;

  let status: (typeof JOB_STATUSES)[number] = "scheduled";
  if (editing) {
    const parsedStatus = z
      .enum(JOB_STATUSES, "Choose the status.")
      .safeParse(textField(formData, "status"));
    if (!parsedStatus.success) {
      return {
        error: parsedStatus.error.issues[0]?.message ?? "Choose the status.",
      };
    }
    status = parsedStatus.data;
  }

  let delivery: z.infer<typeof deliveryForm> | null = null;
  if (job.jobType === "delivery") {
    const parsedDelivery = deliveryForm.safeParse({
      runningNo: textField(formData, "runningNo"),
      transporter: textField(formData, "transporter"),
      deliveredOn: textField(formData, "deliveredOn"),
      items: textField(formData, "items"),
      isFinal: formData.get("isFinal") ?? undefined,
      signedReturned: formData.get("signedReturned") ?? undefined,
    });
    if (!parsedDelivery.success) {
      return {
        error: parsedDelivery.error.issues[0]?.message ?? "Check the details.",
      };
    }
    delivery = parsedDelivery.data;
    if (status === "done" && !delivery.runningNo)
      return { error: DO_NO_NEEDED };
  }

  const supabase = await createClient();
  if (delivery?.runningNo) {
    const problem = await runningNoProblem(
      supabase,
      delivery.runningNo,
      editing ? jobId : null,
    );
    if (problem) return { error: problem };
  }

  const doColumns = delivery && {
    running_no: delivery.runningNo,
    transporter: delivery.transporter,
    delivered_on: delivery.deliveredOn,
    items: delivery.items,
    is_final: delivery.isFinal,
    signed_returned: delivery.signedReturned,
  };
  const jobColumns = {
    status,
    scheduled_on: job.scheduledOn,
    ends_on: job.endsOn,
    start_time: job.startTime,
    installer: job.installer,
    site_supervisor_id: job.siteSupervisorId,
    notes: job.notes,
  };

  if (editing) {
    // The DO goes first: marking a delivery Done needs its running no. to be in place.
    if (doColumns) {
      const { data, error } = await supabase
        .from("delivery_orders")
        .update(doColumns)
        .eq("job_id", jobId)
        .eq("mof_id", job.mofId)
        .select("id");
      if (error)
        return failure(
          error,
          delivery?.runningNo ?? null,
          "Could not save the DO",
        );
      if (data.length === 0) return { error: NOT_FOUND_JOB };
    }
    const { data, error } = await supabase
      .from("jobs")
      .update(jobColumns)
      .eq("id", jobId)
      .eq("mof_id", job.mofId)
      .eq("job_type", job.jobType)
      .select("id");
    if (error) return failure(error, null, "Could not save the job");
    if (data.length === 0) return { error: NOT_FOUND_JOB };
  } else {
    const { data, error } = await supabase
      .from("jobs")
      .insert({ mof_id: job.mofId, job_type: job.jobType, ...jobColumns })
      .select("id");
    if (error) return failure(error, null, "Could not save the job");
    const created = data[0]?.id;
    if (doColumns && created) {
      const { error: doError } = await supabase
        .from("delivery_orders")
        .insert({ mof_id: job.mofId, job_id: created, ...doColumns })
        .select("id");
      if (doError) {
        revalidateJob(job.mofId);
        const result = failure(
          doError,
          delivery?.runningNo ?? null,
          "Could not save the DO",
        );
        return {
          error: `The delivery was scheduled, but its DO details were not saved. ${result.error} Open the delivery to add them.`,
        };
      }
    }
  }

  revalidateJob(job.mofId);
  return { error: null };
}

function failure(
  error: { code?: string; message?: string },
  runningNo: string | null,
  logMessage: string,
): JobResult {
  if (error.code === "23505" && runningNo)
    return { error: usedMessage(runningNo) };
  const message = refusal(error);
  if (message) return { error: message };
  console.error(logMessage, error);
  return { error: TRY_AGAIN };
}

function revalidateJob(mofId: string) {
  revalidatePath(`/mofs/${mofId}`);
  revalidatePath("/installation");
}

/**
 * Moves a job to a new status. A Site Supervisor may do this for jobs assigned to them; the
 * database hides everyone else's, so an unassigned job simply is not found. Gated on
 * Installation, not the MOF register: supervisors cannot open the register.
 */
export async function updateJobStatus(
  mofId: string,
  jobId: string,
  status: (typeof JOB_STATUSES)[number],
): Promise<JobResult> {
  const me = await requirePage("inst");
  if (!canUpdateJobStatus(me.jobRole)) return { error: NOT_SCHEDULER };
  if (
    !mofIdSchema.safeParse(mofId).success ||
    !z.uuid().safeParse(jobId).success
  ) {
    return { error: NOT_FOUND_JOB };
  }
  if (!z.enum(JOB_STATUSES).safeParse(status).success) {
    return { error: "Choose the status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId)
    .eq("mof_id", mofId)
    .select("id");
  if (error) {
    if (error.code === "42501") {
      return { error: "You can only update jobs assigned to you." };
    }
    return failure(error, null, "Could not update the job");
  }
  if (data.length === 0) {
    return { error: "Could not find that job, or it is not assigned to you." };
  }

  revalidateJob(mofId);
  return { error: null };
}
