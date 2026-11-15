import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  creditNoteState,
  LEFTOVER_CONDITION_LABEL,
  LEFTOVER_DESTINATION_LABEL,
  LEFTOVER_KEEP_REASON_LABEL,
  LEFTOVER_RETURN_METHOD_LABEL,
  LEFTOVER_STATUS_LABEL,
  LEFTOVER_UNIT_LABEL,
} from "@/lib/domain/leftover";
import { csvResponse } from "@/lib/format/csv-response";
import { formatDateTime } from "@/lib/format/date";
import { loadLeftovers } from "../leftover-data";

/** The leftover stock list as CSV, in the order the page shows it. */
export async function GET() {
  await requirePage("stock");
  const [leftovers, team] = await Promise.all([
    loadLeftovers(),
    getTeamDirectory(),
  ]);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  return csvResponse(
    "leftover-stock",
    [
      "Item",
      "Qty",
      "Unit",
      "Condition",
      "Destination",
      "Supplier",
      "Why GQ keeps it",
      "How it goes back",
      "Transport",
      "Available",
      "Status",
      "Credit note",
      "Credit note amount (RM)",
      "MOF no.",
      "Project",
      "Note",
      "Recorded",
      "Recorded by",
    ],
    leftovers.map((leftover) => [
      leftover.item,
      leftover.qty,
      LEFTOVER_UNIT_LABEL[leftover.unit],
      LEFTOVER_CONDITION_LABEL[leftover.condition],
      LEFTOVER_DESTINATION_LABEL[leftover.destination],
      leftover.supplier,
      leftover.keepReason
        ? LEFTOVER_KEEP_REASON_LABEL[leftover.keepReason]
        : null,
      leftover.returnMethod
        ? LEFTOVER_RETURN_METHOD_LABEL[leftover.returnMethod]
        : null,
      leftover.transportBy
        ? `${leftover.transportBy} ${leftover.transportOn ?? ""}`.trim()
        : null,
      leftover.status === "at_best_link" ? leftover.available : null,
      LEFTOVER_STATUS_LABEL[leftover.status],
      leftover.creditNoteNo ??
        (creditNoteState(leftover)?.kind === "pending" ? "Pending" : null),
      leftover.creditNoteAmount,
      leftover.mofNo,
      leftover.projectName,
      leftover.note,
      formatDateTime(leftover.recordedOn),
      leftover.recordedBy
        ? (nameOf.get(leftover.recordedBy) ?? "Unnamed")
        : null,
    ]),
  );
}
