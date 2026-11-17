import type { StatusTone } from "@/components/app/status-badge";
import type { ReportStatus } from "@/lib/domain/report-stats";
import type { TravelClaimStatus } from "./travel-claim-data";

/** Jany releases only once the same month's report is in (D3); mirrors guard_travel_claim_write. */
export const reportIsIn = (report: ReportStatus | null): boolean =>
  report !== null && report !== "draft";

export const REPORT_STATUS_TEXT: Record<ReportStatus, string> = {
  draft: "not submitted yet",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
};

/** The pill by the month selector (demo tcSt): where the claim stands for the person. */
export function travelClaimPill(
  claim: { status: TravelClaimStatus; releasedOn: string | null } | null,
  report: ReportStatus | null,
): { label: string; tone: StatusTone; date?: string } {
  if (!claim || claim.status === "draft") {
    return { label: "Not submitted", tone: "neutral" };
  }
  if (claim.status === "released") {
    return {
      label: "Released",
      tone: "good",
      date: claim.releasedOn ?? undefined,
    };
  }
  return reportIsIn(report)
    ? { label: "Ready to release", tone: "info" }
    : { label: "Wait for report", tone: "warn" };
}
