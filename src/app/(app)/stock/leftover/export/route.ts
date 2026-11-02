import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  creditNoteState,
  LEFTOVER_CONDITION_LABEL,
  LEFTOVER_DESTINATION_LABEL,
  LEFTOVER_STATUS_LABEL,
  LEFTOVER_UNIT_LABEL,
} from "@/lib/domain/leftover";
import { csvResponse } from "@/lib/format/csv-response";
import { formatDateTime } from "@/lib/format/date";
import { loadLeftovers } from "../leftover-data";

/** The leftover stock list as CSV, in the order the page shows it. */
export async function GET() {
  await requireSection("stock");
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
