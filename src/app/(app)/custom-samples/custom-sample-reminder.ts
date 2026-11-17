import { formatDate } from "@/lib/format/date";
import type { CustomSample, CustomSampleLoan } from "./custom-sample-types";

/** The WhatsApp text that asks a borrower to bring an overdue sample back (demo tfWaText). */
export function customSampleReminderText(
  sample: Pick<CustomSample, "code" | "designNo" | "designName">,
  loan: Pick<CustomSampleLoan, "customer" | "project" | "outOn" | "dueOn">,
  borrowerName: string,
): string {
  const project = loan.project ? ` – ${loan.project}` : "";
  return `Hi ${borrowerName}, reminder from GQ office: the custom sample *${sample.code} (${sample.designNo}) ${sample.designName}* you borrowed on ${formatDate(loan.outOn)} for ${loan.customer}${project} was due back on ${formatDate(loan.dueOn)}. Please return it to the office as soon as possible. Thank you!`;
}
