import type { StatusTone } from "@/components/app/status-badge";

export const JOB_TYPES = [
  "installation",
  "delivery",
  "site_measurement",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  installation: "Installation",
  delivery: "Delivery",
  site_measurement: "Site measurement",
};

export const JOB_STATUSES = [
  "scheduled",
  "in_progress",
  "done",
  "postponed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Done",
  postponed: "Postponed",
};

export const JOB_STATUS_TONE: Record<JobStatus, StatusTone> = {
  scheduled: "info",
  in_progress: "warn",
  done: "good",
  postponed: "neutral",
};

/** Who delivers. Free text in the database; these are the usual ones offered as suggestions. */
export const TRANSPORTERS = [
  "Best Link",
  "CK",
  "CNB",
  "Carmen",
  "Erwan",
  "FP",
  "Lalamove",
  "Leong",
  "Own Collect",
  "WCD",
] as const;

/** The 4-digit running number Zoho prints on a DO. */
export const isDoRunningNo = (value: string): boolean => /^\d{4}$/.test(value);

/** The full DO number as printed in Zoho: the MOF number followed by the running number. */
export const deliveryOrderNumber = (
  mofNo: string,
  runningNo: string | null,
): string | null => (runningNo ? `${mofNo}${runningNo}` : null);

export type DeliveryStatus = "not_delivered" | "scheduled" | "partial" | "full";

export const DELIVERY_STATUS_TONE: Record<DeliveryStatus, StatusTone> = {
  not_delivered: "neutral",
  scheduled: "info",
  partial: "warn",
  full: "good",
};

type Delivery = { status: JobStatus; isFinal: boolean };

/**
 * Where an MOF stands on delivery, from its delivery jobs (each with its DO's final flag).
 * Postponed deliveries do not count. Fully delivered means a delivery marked as the final
 * one is Done, as in the prototype; any other Done delivery makes it partial.
 */
export function deliveryStatus(deliveries: readonly Delivery[]): {
  state: DeliveryStatus;
  label: string;
  doneCount: number;
} {
  const live = deliveries.filter((delivery) => delivery.status !== "postponed");
  const done = live.filter((delivery) => delivery.status === "done");

  if (done.some((delivery) => delivery.isFinal)) {
    return { state: "full", label: "Fully delivered", doneCount: done.length };
  }
  if (done.length > 0) {
    const plural = done.length > 1 ? "s" : "";
    return {
      state: "partial",
      label: `Partially delivered (${done.length} DO${plural})`,
      doneCount: done.length,
    };
  }
  if (live.length > 0) {
    return { state: "scheduled", label: "Delivery scheduled", doneCount: 0 };
  }
  return { state: "not_delivered", label: "Not delivered", doneCount: 0 };
}

/** What must be ticked on the MOF before goods go out (pre-proceed checks 1 and 4). */
export function missingDeliveryChecks(mof: {
  paymentChecked: boolean;
  dosPreApproved: boolean;
}): string[] {
  const missing: string[] = [];
  if (!mof.paymentChecked) missing.push("payment status not checked");
  if (!mof.dosPreApproved) missing.push("DO not pre-approved by management");
  return missing;
}
