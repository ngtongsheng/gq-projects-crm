import { customerHealth } from "@/lib/domain/customer-health";
import { type CalendarDate, daysBetween } from "@/lib/format/date";

export type CompanyStatus =
  | { kind: "none" }
  | { kind: "active"; idleDays: number }
  | { kind: "quiet"; idleDays: number }
  | { kind: "no_visit"; idleDays: number };

export function companyStatusLabel(status: CompanyStatus): string {
  switch (status.kind) {
    case "none":
      return "No visit yet";
    case "active":
      return "Active";
    case "quiet":
      return `Quiet ${status.idleDays}d`;
    case "no_visit":
      return `No visit ${status.idleDays}d`;
  }
}

/** Day thresholds (Quiet over 60 days, No visit over 90) are the customer health ones, so both lists agree. */
export function companyStatus(
  lastVisit: CalendarDate | null,
  today: CalendarDate,
): CompanyStatus {
  if (lastVisit === null) return { kind: "none" };
  const idleDays = daysBetween(lastVisit, today);
  switch (customerHealth(lastVisit, today)) {
    case "no_activity":
      return { kind: "no_visit", idleDays };
    case "quiet":
      return { kind: "quiet", idleDays };
    default:
      return { kind: "active", idleDays };
  }
}
